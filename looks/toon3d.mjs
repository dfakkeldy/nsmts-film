// looks/toon3d.mjs: the three.js half of the toon3d look (the classic half, looks/toon3d.js, must load first). It
// builds the renderer, the toon materials (MeshToonMaterial on a 3-band NearestFilter gradient map), ink outlines
// (inverted hulls pushed out in view space, so a line is the same width on screen near and far), the golden-hour sun
// and a cool dusk moon with soft PCF shadows, a hemisphere fill, fog, a painted sky with a sun disc, cumulus and stars,
// faces painted on canvas and swapped by key (on a mascot's ball, or as a decal on any object), a mascot that takes any
// body, a few diorama props, and the camera stack (postprocessing: a depth-aware depth of field that leaves the sky
// nearly sharp, bloom on emissives only, vignette and a film grain seeded from the frame index).
//
// Determinism: nothing here reads a clock. Every animated property is set from t in the scene's update(t), the
// composer renders with a fixed delta of 0, shadows re-render every frame (autoUpdate) and the grain's seed is the
// frame index. Faces are pre-painted textures swapped by key, never repainted during a frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BloomEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';

const S = TOON.S;

// ---------- renderer, scene, camera ----------
const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, .1, 700);

const col = c => new THREE.Color(c);
const v3 = (p, out = new THREE.Vector3()) => out.set(p[0], p[1], p[2]);

// ---------- toon materials ----------
// The gradient map: one texel per band, NearestFilter, so light falls off in hard steps. MeshToonMaterial samples it at
// dot(N, L) * .5 + .5, so with 3 texels the band edges sit at dot(N, L) = -1/3 and +1/3.
const gradientMap = new THREE.DataTexture(new Uint8Array(S.bands.map(v => Math.round(v * 255))), S.bands.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter; gradientMap.generateMipmaps = false; gradientMap.unpackAlignment = 1; gradientMap.needsUpdate = true;
// A hard-edged rim of sunlight on the sun side of every silhouette: what makes a backlit toon set read as golden hour.
// RIM.dir is the sun's direction in view space and RIM.col the sun's colour, both set each frame; rim(m, k) sets a
// material's strength (S.rim for props, more for the hero).
const RIM = { dir: { value: new THREE.Vector3(0, 0, -1) }, col: { value: new THREE.Color(0) } };
function rim(m, k = S.rim ?? .45) {
  m.onBeforeCompile = sh => { sh.uniforms.uRimDir = RIM.dir; sh.uniforms.uRimCol = RIM.col; sh.uniforms.uRimK = { value: k };
    sh.fragmentShader = 'uniform vec3 uRimDir; uniform vec3 uRimCol; uniform float uRimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimV = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );
      float rimS = dot( normal, uRimDir ) + .7 * max( - uRimDir.z, 0. );   // sun behind the subject: the rim wraps it
      outgoingLight += uRimCol * uRimK * smoothstep( .6, .66, rimV ) * smoothstep( .05, .3, rimS ) * diffuseColor.rgb;
      #include <opaque_fragment>`); };
  return m;
}
const _toon = new Map();
function toon(color, o = {}) {
  const { rim: rk, ...mo } = o, key = String(color) + JSON.stringify(o); if (_toon.has(key)) return _toon.get(key);
  const m = rim(new THREE.MeshToonMaterial({ color: col(color), gradientMap, ...mo }), rk); _toon.set(key, m); return m;
}
// an unlit colour, may be pushed past 1 (HDR) so bloom picks it up: a bulb, a window
function glow(color, k = 1) { const m = new THREE.MeshBasicMaterial({ color: col(color).multiplyScalar(k), fog: true }); return m; }

// ---------- ink outlines: inverted hulls ----------
// A copy of the mesh, back faces only, pushed out along smooth normals in view space by LINE * depth, so the push is a
// fixed number of pixels on screen (LINE is set from the fov each frame). Hard-edged geometry (cylinders, cones,
// boxes) gets its vertices merged and normals averaged first, or the hull would split open at the edges.
const LINE = { value: 0 };
const _hullGeo = new Map(), _hullMat = new Map();
function hullGeometry(g) {
  if (_hullGeo.has(g.uuid)) return _hullGeo.get(g.uuid);
  const c = g.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k);
  const m = mergeVertices(c, 1e-4); m.computeVertexNormals(); _hullGeo.set(g.uuid, m); return m;
}
// push (world units) moves the hull back along the view ray: it stays where it is on screen but sits deeper, so where
// another part of the same cluster lies within push behind it (the balls of a canopy), that part hides the line. The
// cluster keeps its outer silhouette and loses the arcs where its balls meet.
function hullMaterial(color = S.ink, mul = 1, push = 0) {
  const key = color + '|' + mul + '|' + push; if (_hullMat.has(key)) return _hullMat.get(key);
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: col(color) }, uMul: { value: mul }, uPush: { value: push } }]); u.uLine = LINE;
  const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, fog: true,
    vertexShader: `uniform float uLine; uniform float uMul; uniform float uPush;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        vec3 n = normalize( normalMatrix * normal );
        mvPosition.xyz += n * uLine * uMul * max( - mvPosition.z, .5 );
        mvPosition.xyz *= 1. + uPush / max( length( mvPosition.xyz ), .01 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4( uColor, 1.0 );
        #include <fog_fragment>
      }` });
  _hullMat.set(key, m); return m;
}
// outline(mesh, mul, color, push): give a mesh an ink line (mul scales the width: .6 for small props, 1.25 for the
// hero; push hides the line inside a cluster, see hullMaterial)
function outline(mesh, mul = 1, color = S.ink, push = 0) {
  const h = new THREE.Mesh(hullGeometry(mesh.geometry), hullMaterial(color, mul, push)); h.castShadow = h.receiveShadow = false; h.name = 'hull';
  mesh.add(h); mesh.userData.hull = h; return h;
}

// ---------- geometry (cached) and meshes ----------
const _geo = new Map();
const geo = (key, make) => { if (!_geo.has(key)) _geo.set(key, make()); return _geo.get(key); };
const G = {
  box: (w, h, d, r = .05, s = 3) => geo(`box${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))),
  ball: (r = 1, ws = 40, hs = 28) => geo(`ball${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  capsule: (r, len, cs = 8, rs = 20) => geo(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  cyl: (rt, rb, h, s = 28) => geo(`cyl${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 24) => geo(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  // lathe: a profile of [r, y] points listed from the top down; LatheGeometry wants bottom-up for outward faces
  lathe: (pts, s = 72) => geo('lathe' + pts.join(';') + s, () => new THREE.LatheGeometry(pts.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y)), s)),
  rock: (r, seed) => geo(`rock${r},${seed}`, () => { const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, R = rnd(seed);
    const off = new Map(); for (let i = 0; i < p.count; i++) { const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join(); if (!off.has(k)) off.set(k, .78 + .3 * R()); const s = off.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s); }
    g.computeVertexNormals(); return g; }),
};
// mesh(geometry, colorOrMaterial, o): a toon mesh with an outline. o: at, rot, scale (number or [x, y, z]), parent,
// line (outline width multiplier; false for none), ink (line colour), inkPush (see hullMaterial), cast, receive
function mesh(g, c, o = {}) {
  const m = new THREE.Mesh(g, c && c.isMaterial ? c : toon(c));
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  if (o.at) m.position.set(...o.at); if (o.rot) m.rotation.set(...o.rot);
  if (o.scale != null) Array.isArray(o.scale) ? m.scale.set(...o.scale) : m.scale.setScalar(o.scale);
  if (o.line !== false) outline(m, o.line ?? 1, o.ink, o.inkPush || 0);
  (o.parent || scene).add(m); return m;
}
const group = (parent = scene, at = [0, 0, 0], ry = 0) => { const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); return g; };

// ---------- light, sky, fog ----------
// The day is a table of looks keyed 0 (golden hour) .. 1 (dusk); daylight(d) blends them. Colours are sRGB hex here
// and blended in linear space. sunI is the sun's intensity, fill the hemisphere's, moonI a cool key from high on the
// camera side. The moon matters: MeshToonMaterial bands only the direct lights, and the hemisphere fill shades smoothly,
// so once the sun is down a set with no key light loses its toon bands and reads as flat colour. The moon stays at 0
// until sunset (.5), so the golden-hour frames are lit by the sun alone, and reaches about 1 by d = .86.
const DAY = (S.day || [
  { at: 0, zenith: '#7F9AD6', mid: '#F4B990', horizon: '#FFDDA0', below: '#E9B6A4', sun: '#FFC27A', sunI: 3.1, sky: '#E9CBD9', ground: '#8C6E52', fill: 1.3, fog: '#F2C6A6', disc: '#FFE9B8', stars: 0,
    moon: '#A9B4FF', moonI: 0, cShade: '#B7A3D6', cTop: '#DCCDEE', cLit: '#FFC8A2', cRim: '#FFE7BE', cSun: 1 },
  { at: .5, zenith: '#5466AE', mid: '#E9918A', horizon: '#FFB178', below: '#C98C9E', sun: '#FF9058', sunI: 1.5, sky: '#B9B4EC', ground: '#6A5466', fill: 1.45, fog: '#D99A98', disc: '#FFD08A', stars: .1,
    moon: '#A9B4FF', moonI: 0, cShade: '#9C88C4', cTop: '#C3AEDF', cLit: '#FF9F86', cRim: '#FFC59A', cSun: .8 },
  { at: 1, zenith: '#22295E', mid: '#4D4B8C', horizon: '#B47A94', below: '#5E5488', sun: '#FF8050', sunI: 0, sky: '#8F9CF0', ground: '#4A3A5E', fill: .85, fog: '#5F5890', disc: '#FFC080', stars: 1,
    moon: '#A9B4FF', moonI: 2.2, cShade: '#5E5A98', cTop: '#7E78B6', cLit: '#C8829E', cRim: '#D892AE', cSun: .25 },
]).map(e => ({ ...e, c: Object.fromEntries(Object.entries(e).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, col(v)])) }));
// Both keys cast shadows all film long. Toggling castShadow mid-film changes every material's program (a recompile and
// a slow frame), and a light at intensity 0 casts nothing visible anyway.
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
sun.shadow.mapSize.set(S.shadowMap, S.shadowMap); sun.shadow.radius = S.shadowRadius; sun.shadow.bias = -.0004; sun.shadow.normalBias = .025;
const SHADOW = S.shadowExtent || 7; Object.assign(sun.shadow.camera, { left: -SHADOW, right: SHADOW, top: SHADOW, bottom: -SHADOW, near: 1, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0xffffff, 0); moon.castShadow = true;
moon.shadow.mapSize.set(S.moonShadowMap || 1024, S.moonShadowMap || 1024); moon.shadow.radius = S.shadowRadius * 1.3; moon.shadow.bias = -.0005; moon.shadow.normalBias = .03;
Object.assign(moon.shadow.camera, { left: -SHADOW, right: SHADOW, top: SHADOW, bottom: -SHADOW, near: 1, far: 90 }); moon.shadow.camera.updateProjectionMatrix();
scene.add(moon, moon.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
scene.fog = new THREE.Fog(0xffffff, ...(S.fog || [60, 420]));

// The sky is painted, not built, like an anime background: a gradient, the sun disc and its halo, thin streaks of high
// cloud, a streaked cloud sea below the horizon, and two banks of cumulus on the horizon (a far one with two tall
// rounded towers, a nearer, flatter one). A bank's top edge is one continuous skyline (billow noise: round tops, sharp
// valleys; never circles side by side, whose steep sides leave vertical seams). The far bank is shaded in hard toon
// bands: lavender below, a paler band along the top that turns peach toward the sun, a thin warm rim on the edge. The
// near bank is one flat shade sunk toward the sea haze (a pale band and rim on it read as a seam across the frame).
// Stars are drawn in the sky itself, before the banks, so a bank hides the stars behind it; they fade in with
// daylight(). The sun is drawn first, so it sets behind the bank. Azimuths are measured from the sun, so the seam sits
// behind the camera. drift (radians) slides the clouds; skyClouds() reshapes them. The depth of field leaves the sky
// almost sharp (S.dof.sky), like a painted backdrop behind a soft middle ground.
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { stars: { value: 0 }, starSize: { value: (S.starSize ?? .9) / 1000 }, zenith: { value: col('#000') }, mid: { value: col('#000') }, horizon: { value: col('#000') }, below: { value: col('#000') }, disc: { value: col('#fff') },
    sunDir: { value: new THREE.Vector3(0, .1, -1) }, sunSize: { value: .026 }, sunShow: { value: 1 }, haze: { value: 1 }, sunAz: { value: 0 }, sunEl: { value: .05 }, drift: { value: 0 },
    cShade: { value: col('#fff') }, cTop: { value: col('#fff') }, cLit: { value: col('#fff') }, cRim: { value: col('#fff') }, cSun: { value: 1 },
    bank: { value: new THREE.Vector4(.004, .045, -.03, .06) }, towers: { value: new THREE.Vector4(-.16, .2, .085, .065) }, streaks: { value: 1 } },
  vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: `uniform vec3 zenith, mid, horizon, below, disc, sunDir, cShade, cTop, cLit, cRim; uniform vec4 bank, towers;
    uniform float sunSize, sunShow, haze, sunAz, sunEl, drift, cSun, streaks, stars, starSize; varying vec3 vDir;
    #define PI 3.141592653589793
    float h1( float n ) { return fract( sin( n * 127.1 + 311.7 ) * 43758.5453 ); }
    float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); float n = i.x + i.y * 57.;
      return mix( mix( h1( n ), h1( n + 1. ), f.x ), mix( h1( n + 57. ), h1( n + 58. ), f.x ), f.y ); }
    // billow noise: round tops, sharp valleys, the profile of a cumulus skyline
    float billow( float x ) { return abs( 2. * vn( vec2( x, 7.31 ) ) - 1. ); }
    // one bank of cumulus over colour c, its top edge a continuous skyline (no seams): base + amp * two octaves of billow.
    // Toon bands follow the edge: a paler band along the top (peach toward the sun), a thin warm rim on the edge, the
    // lavender shade below. dark pushes a nearer bank toward the sea haze.
    vec3 cloudBank( vec3 c, float a, float el, float base, float amp, float freq, float seed, float dark, float dark0, float lit ) {
      float x = a * freq + seed, top = base + amp * ( .62 * billow( x ) + .38 * billow( x * 2.4 + 1.7 ) );
      // towers: tall rounded heads (semicircles with a billowed edge) standing on the bank, at towers.xy (azimuths
      // from the sun) with heights towers.zw; the sun sets between them
      for ( int i = 0; i < 2; i ++ ) { float c = i == 0 ? towers.x : towers.y, hgt = i == 0 ? towers.z : towers.w, u = ( a - c ) / ( hgt * 1.25 );
        if ( abs( u ) < 1. ) top = max( top, base + amp * .4 + hgt * sqrt( 1. - u * u ) * ( .88 + .12 * billow( x * 3.3 + float( i ) * 5. ) ) * dark0 ); }
      float e = top - el, aa = fwidth( el ) * 1.2; if ( e < - aa ) return c;
      float near = exp( - abs( a ) * 2.2 );                    // 1 at the sun's azimuth, fading to the sides
      float band = ( 1. - smoothstep( amp * .3 - aa, amp * .3 + aa, e ) ) * lit;
      vec3 k = mix( cShade, mix( cTop, cLit, near * cSun * .85 ), band * ( .5 + .5 * near ) );
      k = mix( k, cRim, ( 1. - smoothstep( .003 - aa, .003 + aa, e ) ) * ( .3 + .7 * near ) * cSun * lit );
      k = mix( k, below, dark );
      return mix( c, k, smoothstep( - aa, aa, e ) ); }
    void main() {
      vec3 d = normalize( vDir ); float h = d.y;
      vec3 c = mix( horizon, mid, smoothstep( .0, .2, h ) );
      c = mix( c, zenith, smoothstep( .14, .75, h ) );
      c = mix( c, below, 1. - smoothstep( -.22, .0, h ) );
      float g = max( dot( d, sunDir ), 0. );
      c += disc * ( pow( g, 14. ) * .3 + pow( g, 200. ) * .5 ) * haze;
      c = mix( c, disc * 2.4, smoothstep( cos( sunSize ), cos( sunSize * .82 ), dot( d, sunDir ) ) * sunShow );
      float az = atan( d.x, d.z ), el = asin( clamp( h, -1., 1. ) ), a = mod( az - sunAz + PI, 2. * PI ) - PI;
      // high streaks: long, thin, lit from below on the sun side
      float band = smoothstep( .1, .17, el ) * ( 1. - smoothstep( .3, .42, el ) );
      float st = vn( vec2( ( a + drift * .6 ) * 2.2, el * 34. ) ) * .65 + vn( vec2( ( a + drift * .6 ) * 6.5, el * 70. ) ) * .35;
      float sm = smoothstep( .6, .63, st * band + ( 1. - band ) * .2 ) * streaks;
      c = mix( c, mix( mix( cTop, cLit, .55 * cSun ), cRim, smoothstep( .9, 1., g ) * cSun ), sm * .85 );
      // the cloud sea below the horizon: long soft bands of a paler shade
      float sea = ( 1. - smoothstep( -.03, .0, el ) ) * smoothstep( .58, .62, vn( vec2( ( a + drift * 2. ) * 4., el * 55. ) ) );
      c = mix( c, mix( below, cTop, .35 ), sea * .7 );
      // stars: one seeded point per cell of a grid in (azimuth, elevation), about a third of the cells lit, fading out
      // toward the horizon haze; hard dots with a pixel of antialiasing, sized in radians (starSize)
      if ( stars > .001 ) { vec2 q = vec2( ( az + drift * .3 ) * cos( el ), el ) * 46.; vec2 ci = floor( q ), cf = fract( q );
        float hs = h1( ci.x * 3.17 + ci.y * 91.3 ), hx = h1( ci.x * 7.7 + ci.y * 13.1 + 5. ), hy = h1( ci.x * 1.9 + ci.y * 47.3 + 9. );
        float r = length( ( cf - vec2( .2 + .6 * hx, .2 + .6 * hy ) ) / 46. ), rad = starSize * ( .55 + .7 * h1( hs * 91. ) ), px = fwidth( el ) * .8;
        float s = ( 1. - smoothstep( rad - px, rad + px, r ) ) * step( .7, hs ) * smoothstep( .02, .09, el ) * stars * ( .55 + .45 * h1( hs * 37. ) );
        c = mix( c, vec3( 1., .96, .86 ), s ); }
      c = cloudBank( c, a + drift, el, bank.x, bank.y, 13., 1., 0., 1., 1. );          // the far bank (with its towers) the sun sets into
      c = cloudBank( c, a + drift * 1.6, el, bank.z, bank.w, 4.5, 11., .45, 0., 0. );   // a nearer, lower bank: one flat shade, sunk into the haze
      gl_FragColor = vec4( c, 1. );
    }` }));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

// the cloud material: its own toon shading, lit by the day table, not by the scene lights: a lavender shade, a paler
// band on top (sky light), a peach band on the sun side and a thin warm rim where the surface turns away from the
// camera toward the sun. Hard band edges, fog on.
const cloudMat = new THREE.ShaderMaterial({ fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShade: { value: col('#fff') }, uTop: { value: col('#fff') }, uLit: { value: col('#fff') }, uRim: { value: col('#fff') }, uSunDir: { value: new THREE.Vector3(0, .1, -1) }, uSun: { value: 1 } }]),
  vertexShader: `varying vec3 vN; varying vec3 vW;
    #include <common>
    #include <fog_pars_vertex>
    void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal );
      vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 uShade, uTop, uLit, uRim, uSunDir; uniform float uSun; varying vec3 vN; varying vec3 vW;
    #include <common>
    #include <fog_pars_fragment>
    void main() { vec3 n = normalize( vN ), v = normalize( cameraPosition - vW );
      vec3 c = mix( uShade, uTop, smoothstep( .44, .5, n.y ) );
      float l = dot( n, uSunDir );
      c = mix( c, uLit, smoothstep( .2, .26, l ) * uSun );
      float rim = ( 1. - max( dot( n, v ), 0. ) ) * smoothstep( -.25, .35, l );
      c = mix( c, uRim, smoothstep( .8, .83, rim ) * uSun * .7 );
      gl_FragColor = vec4( c, 1. );
      #include <fog_fragment>
    }` });

const _sunDir = new THREE.Vector3(), _c = new THREE.Color();
const SUN = { az: -60, el: 4, lift: S.sunLift ?? 9, target: new THREE.Vector3(0, 0, 0) };
// sunAt(az, el, o): put the sun disc at azimuth az, elevation el (degrees; az 0 is +z, -90 is -x). The light itself comes
// from el + o.lift (default 9 degrees) so faces still catch it as the disc touches the horizon. o.target: what the
// shadow camera centres on.
function sunAt(az, el, o = {}) {
  SUN.az = az; SUN.el = el; if (o.lift != null) SUN.lift = o.lift; if (o.target) v3(o.target, SUN.target);
  const a = az * Math.PI / 180, e = el * Math.PI / 180, le = (el + SUN.lift) * Math.PI / 180;
  sky.material.uniforms.sunDir.value.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  cloudMat.uniforms.uSunDir.value.set(Math.sin(a) * Math.cos(le), Math.sin(le), Math.cos(a) * Math.cos(le));
  sky.material.uniforms.sunAz.value = a; sky.material.uniforms.sunEl.value = e;
  _sunDir.set(Math.sin(a) * Math.cos(le), Math.sin(le), Math.cos(a) * Math.cos(le));
  sun.position.copy(SUN.target).addScaledVector(_sunDir, 40); sun.target.position.copy(SUN.target); sun.target.updateMatrixWorld();
}
// moonAt(az, el): where the cool dusk key comes from (degrees, as sunAt). Put it high (35-50 degrees) and 45-90 degrees
// to one side of the camera: a key straight from the camera lights the whole visible side and shows no bands either.
const _moonDir = new THREE.Vector3();
function moonAt(az, el = 40) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180; _moonDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  moon.position.copy(SUN.target).addScaledVector(_moonDir, 40); moon.target.position.copy(SUN.target); moon.target.updateMatrixWorld();
}
// daylight(d): sky, sun colour and strength, fill, fog and stars for d in 0 (golden hour) .. 1 (dusk)
function daylight(d) {
  d = clamp(d); let i = 0; while (i + 2 < DAY.length && d > DAY[i + 1].at) i++;
  const A = DAY[i], B = DAY[i + 1] || A, k = B === A ? 0 : ease(invLerp(A.at, B.at, d));
  const mix = key => _c.copy(A.c[key]).lerp(B.c[key], k);
  const U = sky.material.uniforms; for (const key of ['zenith', 'mid', 'horizon', 'below', 'disc']) U[key].value.copy(mix(key));
  sun.color.copy(mix('sun')); sun.intensity = lerp(A.sunI, B.sunI, k);
  moon.color.copy(mix('moon')); moon.intensity = lerp(A.moonI ?? 0, B.moonI ?? 0, k);
  hemi.color.copy(mix('sky')); hemi.groundColor.copy(mix('ground')); hemi.intensity = lerp(A.fill, B.fill, k);
  scene.fog.color.copy(mix('fog'));
  U.stars.value = lerp(A.stars, B.stars, k);
  for (const [u, key] of [['cShade', 'cShade'], ['cTop', 'cTop'], ['cLit', 'cLit'], ['cRim', 'cRim']]) U[u].value.copy(mix(key)); U.cSun.value = lerp(A.cSun, B.cSun, k);
  const CU = cloudMat.uniforms; CU.uShade.value.copy(mix('cShade')); CU.uTop.value.copy(mix('cTop')); CU.uLit.value.copy(mix('cLit')); CU.uRim.value.copy(mix('cRim')); CU.uSun.value = lerp(A.cSun, B.cSun, k) * (1 - ease(invLerp(.6, .9, d)));   // 3D puffs lose their sun side by dusk (no pink slivers)
  return { d, k };
}

// ---------- the camera ----------
const _p = new THREE.Vector3(), _q = new THREE.Vector3();
const FOCUS = { dist: 10, point: new THREE.Vector3() };
// camera(c): apply a rig state { pos, at, fov, focus } (TOON.rig returns one)
function setCamera(c) {
  v3(c.pos, camera.position); camera.lookAt(v3(c.at, _q));
  if (camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(); v3(c.focus || c.at, FOCUS.point); FOCUS.dist = camera.position.distanceTo(FOCUS.point);
}
// project([x, y, z]) -> [x, y] in frame pixels (after camera())
function project(p) { v3(p, _p).project(camera); return [(_p.x + 1) / 2 * W, (1 - _p.y) / 2 * H]; }
// worldOf(object, [x, y, z]) -> a local point of an object in world space, as an array
function worldOf(obj, p = [0, 0, 0]) { obj.updateWorldMatrix(true, false); v3(p, _p).applyMatrix4(obj.matrixWorld); return [_p.x, _p.y, _p.z]; }

// ---------- faces and the mascot ----------
// A face is a texture painted once per key and swapped by key, so expressions change on a frame boundary and never
// cost a repaint. Keys: 'open', 'wow', 'grit' (determined: lids cut flat, a set mouth), each with an optional look
// ':l' ':r' ':u' ':d' (the eyes shift about a third of their spacing, so a glance reads on screen), and 'blink',
// 'shut', 'happy'. paintFace(key, o) paints one: o.decal false (default) paints the whole body colour onto a 2:1 sphere
// texture with the face at u = .25 (the sphere's +z side); o.decal true paints only the features on a transparent
// square, for face(). o: body, cheek, tongue, ink.
const FACE_W = 1024, FACE_H = 512, FACE_KEYS = ['open', 'open:l', 'open:r', 'open:u', 'open:d', 'wow', 'wow:u', 'grit', 'grit:u', 'blink', 'shut', 'happy'];
function paintFace(key, o = {}) {
  o = { body: '#FFF3E2', cheek: '#F59AA4', tongue: '#F27C8C', ink: S.ink, ...o };
  const dec = !!o.decal, c = document.createElement('canvas'); c.width = dec ? 512 : FACE_W; c.height = dec ? 512 : FACE_H;
  const x = c.getContext('2d'), k = dec ? 2 : 1, cx = dec ? 256 : FACE_W * .25, cy = dec ? 236 : FACE_H * .47;
  if (!dec) { x.fillStyle = o.body; x.fillRect(0, 0, c.width, c.height); }
  x.translate(cx, cy); x.scale(k, k);   // features in sphere-texture px around the face centre
  const [expr, look = 'c'] = key.split(':'), lx = { l: -1, r: 1 }[look] || 0, ly = { u: -1, d: 1 }[look] || 0, gap = 46, ink = o.ink;
  // cheeks: blended over the body on a sphere, pre-blended and opaque on a decal (alpha-tested edges)
  x.fillStyle = dec ? '#' + col(o.body).lerp(col(o.cheek), .55).getHexString() : o.cheek; x.globalAlpha = dec ? 1 : .55;
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 86 + lx * 8, 34 + ly * 4, 27, 14, 0, 0, TAU); x.fill(); } x.globalAlpha = 1;
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = ink; x.fillStyle = ink;
  const ex = s => s * gap + lx * 30, ey = ly * 28;
  const eye = (s, big) => { x.fillStyle = ink; x.beginPath(); x.ellipse(ex(s), ey, 14 * big, 21 * big, 0, 0, TAU); x.fill();
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(ex(s) - 4 * big + lx * 3, ey - 8 * big + ly * 3, 5.5 * big, 0, TAU); x.fill(); x.beginPath(); x.arc(ex(s) + 4.5 * big, ey + 7 * big, 2.6 * big, 0, TAU); x.fill(); };
  if (expr === 'open' || expr === 'wow') { for (const s of [-1, 1]) eye(s, expr === 'wow' ? 1.28 : 1); }
  else if (expr === 'grit') {   // the top of each eye cut by a lid slanting down toward the nose, the lid inked
    for (const s of [-1, 1]) { const xi = ex(s) - s * 21, xo = ex(s) + s * 21, yi = ey - 2, yo = ey - 15;
      x.save(); x.beginPath(); x.moveTo(xi, yi); x.lineTo(xo, yo); x.lineTo(xo, ey + 40); x.lineTo(xi, ey + 40); x.closePath(); x.clip(); eye(s, 1.05); x.restore();
      x.lineWidth = 6.5; x.beginPath(); x.moveTo(xi, yi); x.lineTo(xo, yo); x.stroke(); }
  } else if (expr === 'blink' || expr === 'shut') {
    x.lineWidth = 6.5; for (const s of [-1, 1]) { x.beginPath(); x.arc(ex(s), ey - 6, 15, Math.PI * .15, Math.PI * .85); x.stroke(); }
  } else if (expr === 'happy') {
    x.lineWidth = 7; for (const s of [-1, 1]) { x.beginPath(); x.arc(ex(s), ey + 8, 15, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
  }
  x.fillStyle = ink; x.strokeStyle = ink; x.lineWidth = 6;
  const mx = lx * 14, my = ly * 12;
  if (expr === 'wow') { x.beginPath(); x.ellipse(mx, 42 + my, 9, 11, 0, 0, TAU); x.fill(); }
  else if (expr === 'happy') { x.beginPath(); x.moveTo(-17, 33); x.quadraticCurveTo(0, 62, 17, 33); x.closePath(); x.fill();
    x.fillStyle = o.tongue; x.beginPath(); x.ellipse(0, 45, 8, 5, 0, 0, TAU); x.fill(); }
  else if (expr === 'grit') { x.beginPath(); x.moveTo(mx - 12, 36 + my); x.quadraticCurveTo(mx, 31 + my, mx + 12, 36 + my); x.stroke(); }
  else { x.beginPath(); x.arc(mx, 30 + my, 11, Math.PI * .2, Math.PI * .8); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; return tex;
}
// face(parent, o): a face decal on any object (a cup, a phone, a letter tile, a chat bubble): a small square plane
// whose texture is swapped by key. o: at (in the parent's space), normal (which way the face looks, default +z), up,
// size (world units across the cheeks), keys (default FACE_KEYS), body (the surface colour behind it, for the cheeks),
// cheek, ink, receive (shadows). The plane is alpha-tested with alpha-to-coverage (smooth edges under MSAA) and pulled
// forward with polygonOffset, so it never fights the surface: keep it on a flat or gently curved patch, under about
// .6 of the surface's radius of curvature, and lift it .005 off the surface. Returns { mesh, set(key), key }.
const _planes = new Map();
function face(parent, o = {}) {
  o = { at: [0, 0, 0], normal: [0, 0, 1], up: [0, 1, 0], size: .3, keys: FACE_KEYS, ...o };
  const tex = {}; for (const k of o.keys) tex[k] = paintFace(k, { ...o, decal: true });
  const mat = new THREE.MeshToonMaterial({ map: tex[o.keys[0]], gradientMap, alphaTest: .5, alphaToCoverage: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const g = _planes.get(1) || (_planes.set(1, new THREE.PlaneGeometry(1, 1)), _planes.get(1));
  const m = new THREE.Mesh(g, mat); m.scale.setScalar(o.size / .88); m.position.set(...o.at);   // the features span .88 of the square
  const n = v3(o.normal).normalize(), up = v3(o.up, new THREE.Vector3()), xAxis = new THREE.Vector3().crossVectors(up, n).normalize(), yAxis = new THREE.Vector3().crossVectors(n, xAxis);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, n));
  m.castShadow = false; m.receiveShadow = o.receive ?? true; m.name = 'face'; parent.add(m);
  const api = { mesh: m, key: o.keys[0], set(k) { if (tex[k]) { mat.map = tex[k]; api.key = k; } return api; } };
  return api;
}
// mascot(o): a round body with a face, two feet, two stubby arms and a two-leaf sprout. o.shape swaps the body for any
// geometry spanning about -1..1 on each axis (G.box(2, 2, 1.6, .35) for a phone or a tile, G.lathe(...) for a cup);
// it is scaled like the ball, [r, r * tall, r * .94]. o.face: 'uv' paints the face onto the ball's own texture (the
// default for the ball), 'decal' puts a face() on the front (the default for any other shape; o.faceAt, o.faceSize in
// body units), false for none. o: body (colour), cheek, tongue, leaf, r, tall, line, rim, sprout (false for none),
// receiveShadow. Pose with mascot.pose(p) from the scene's update, with p read at TOON.two(t) so the acting lands on twos.
function mascot(o = {}) {
  o = { body: '#FFF3E2', cheek: '#F59AA4', tongue: '#F27C8C', leaf: '#6FB86A', r: .4, tall: 1.1, line: 1.25, ...o };
  const root = group(o.parent || scene, o.at || [0, 0, 0], o.ry || 0), pivot = group(root);
  const R = o.r, HY = R * o.tall, mode = o.face ?? (o.shape ? 'decal' : 'uv'), faces = {};
  const shape = o.shape || G.ball(1, 56, 40); if (!shape.boundingBox) shape.computeBoundingBox(); const bb = shape.boundingBox;
  const shX = o.shape ? bb.max.x + .1 : .9;   // shoulders: on a ball's curve, or just outside a flat side
  if (mode === 'uv') for (const e of FACE_KEYS) faces[e] = paintFace(e, o);
  const skin = mode === 'uv' ? rim(new THREE.MeshToonMaterial({ color: 0xffffff, map: faces.open, gradientMap }), o.rim ?? 1.1) : toon(o.body, { rim: o.rim ?? 1.1 });
  const body = mesh(shape, skin, { parent: pivot, at: [0, HY, 0], scale: [R, HY, R * .94], line: o.line });
  const decal = mode === 'decal' ? face(body, { ...o, at: o.faceAt || [0, .08, bb.max.z + .005], size: o.faceSize || 1.15 }) : null;
  if (decal) decal.mesh.scale.y *= R / HY;   // undo the body's taller y scale so the face stays round
  const limb = toon(o.body, { rim: o.rim ?? 1.1 });
  const feet = [-1, 1].map(s => mesh(G.ball(1, 24, 16), limb, { parent: pivot, at: [s * R * .42, R * .1, R * .18], scale: [R * .27, R * .17, R * .34], line: o.line * .8 }));
  const arms = [-1, 1].map(s => { const sh = group(pivot, [s * R * shX, HY * 1.02, 0]); mesh(G.capsule(R * .17, R * .34), limb, { parent: sh, at: [0, -R * .27, 0], line: o.line * .8 }); sh.rotation.z = s * .35; return sh; });
  const sprout = group(pivot, [0, HY * (1 + bb.max.y) - R * .03, 0]);
  if (o.sprout !== false) { mesh(G.cyl(R * .035, R * .05, R * .3, 10), toon(o.leaf), { parent: sprout, at: [0, R * .14, 0], line: .6 });
    for (const s of [-1, 1]) mesh(G.ball(1, 20, 12), toon(o.leaf), { parent: sprout, at: [s * R * .2, R * .3, 0], rot: [0, 0, -s * .45], scale: [R * .24, R * .07, R * .14], line: .7 }); }
  // pose(p): pos [x, y, z] (the feet), ry (facing, radians; 0 faces +z), sy (squash-stretch, volume kept), lean (forward,
  // radians; negative leans back, as when looking up), roll (sideways sway, radians), face (key), arms [[raise, swing],
  // [raise, swing]] (radians: raise lifts the arm sideways, swing forward), sprout (sway, radians), sproutX, sit (0..1:
  // feet forward and up, as on a seat), swing [l, r] (feet swinging while sitting), bob (y offset of the body only)
  function pose(p) {
    if (p.pos) root.position.set(...p.pos); root.rotation.y = p.ry ?? root.rotation.y;
    const sy = p.sy ?? 1, sxz = 1 / Math.sqrt(sy); pivot.scale.set(sxz, sy, sxz); pivot.rotation.x = p.lean || 0; pivot.rotation.z = p.roll || 0;
    body.position.y = HY + (p.bob || 0);
    if (decal) decal.set(p.face || 'open'); else if (mode === 'uv') skin.map = faces[p.face || 'open'] || faces.open;
    const sit = p.sit || 0, sw = p.swing || [0, 0];
    feet.forEach((f, i) => { f.position.set((i ? 1 : -1) * R * .42, R * .1 + sit * R * .05 + sw[i] * R * .12, R * .18 + sit * R * .55 + sw[i] * R * .05); f.rotation.x = -sit * .5 - sw[i] * .4; });
    const A = p.arms || [[0, 0], [0, 0]];
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-A[i][1], 0, s * (.35 + A[i][0])); });
    sprout.rotation.z = p.sprout || 0; sprout.rotation.x = (p.sproutX || 0);
  }
  // the hero casts shadows but never receives them: a low sun behind the set throws long soft shadows of a bench's
  // slats, or of its own far arm, across its body, and they read as the body going see-through
  root.traverse(m => { if (m.isMesh) m.receiveShadow = o.receiveShadow ?? false; });
  pose({});
  return { root, pivot, body, feet, arms, sprout, faces, decal, pose, head: () => worldOf(body, [0, .95, 0]) };
}

// ---------- diorama props ----------
// island(o): a floating disc of grass over an earth cone, with a few hanging rocks. Top surface at y = 0.
function island(o = {}) {
  o = { r: 4, grass: '#8CC06A', earth: '#C98B5F', rockCol: '#B07A57', seed: 3, ...o };
  const g = group(o.parent || scene, o.at || [0, 0, 0]), r = o.r;
  mesh(G.lathe([[0, 0], [r * .6, 0], [r * .96, -.02], [r * 1.02, -.12], [r * 1.0, -.26], [r * .93, -.3], [0, -.3]], 96), o.grass, { parent: g, line: 1.1 });
  mesh(G.lathe([[0, -.18], [r * .95, -.24], [r * .9, -.7], [r * .72, -1.4], [r * .48, -2.1], [r * .24, -2.7], [r * .06, -3.05], [0, -3.1]], 96), o.earth, { parent: g, line: 1.1 });
  const R = rnd(o.seed);
  for (let i = 0; i < (o.rocks ?? 4); i++) { const a = R() * TAU, d = r * (.35 + R() * .35), s = .18 + R() * .22;
    mesh(G.rock(s, o.seed * 10 + i), o.rockCol, { parent: g, at: [Math.cos(a) * d, -2.2 - R() * 1.4 - (i === 0 ? .6 : 0), Math.sin(a) * d], rot: [R() * 3, R() * 3, 0], line: .8 }); }
  return g;
}
// tree(o): a trunk and a canopy of overlapping balls; returns { root, canopy } (sway the canopy from t). The canopy's
// hulls are pushed back (o.inkPush, default .7 r) so it reads as one inked silhouette, not a pile of inked balls.
function tree(o = {}) {
  o = { h: 1.4, r: .7, trunk: '#9A6346', leaf: '#4F9A72', seed: 5, ...o };
  const root = group(o.parent || scene, o.at || [0, 0, 0], o.ry || 0), R = rnd(o.seed);
  mesh(G.cyl(o.h * .06, o.h * .1, o.h, 16), o.trunk, { parent: root, at: [0, o.h / 2, 0] });
  const canopy = group(root, [0, o.h, 0]);
  const puffs = o.puffs || [[0, .45, 0, 1], [-.55, .15, .1, .72], [.55, .2, -.05, .76], [.05, .95, -.05, .7], [-.1, .2, .5, .62]];
  for (const [x, y, z, s] of puffs) mesh(G.ball(1, 36, 24), o.leaf, { parent: canopy, at: [x * o.r, y * o.r, z * o.r], scale: s * o.r * (.95 + .1 * R()), line: o.line ?? 1, inkPush: o.inkPush ?? .7 * o.r });
  return { root, canopy };
}
function bush(at, r = .3, color = '#4F9A72', parent = scene) { return mesh(G.ball(1, 32, 20), color, { parent, at: [at[0], at[1] + r * .55, at[2]], scale: [r, r * .8, r] }); }
// bench(o): two seat slats and two back slats on dark iron legs, facing local +z; returns { root, seatY } (seat top .44)
function bench(o = {}) {
  o = { w: 1.3, wood: '#C2704A', iron: '#3B3350', ...o };
  const g = group(o.parent || scene, o.at || [0, 0, 0], o.ry || 0), w = o.w;
  for (const z of [-.1, .1]) mesh(G.box(w, .06, .17, .025), o.wood, { parent: g, at: [0, .41, z] });
  for (const y of [.62, .8]) mesh(G.box(w, .12, .05, .02), o.wood, { parent: g, at: [0, y, -.24], rot: [-.12, 0, 0] });
  for (const s of [-1, 1]) { mesh(G.box(.06, .42, .4, .02), o.iron, { parent: g, at: [s * (w / 2 - .12), .2, 0], line: .7 }); mesh(G.box(.05, .5, .05, .02), o.iron, { parent: g, at: [s * (w / 2 - .12), .66, -.24], rot: [-.12, 0, 0], line: .7 }); }
  return { root: g, seatY: .44 };
}
// lamp(o): a post with a lantern, a bulb, a pull-cord and a warm point light. set(on, pull): on 0..1 lights it (bulb
// pushed past white so the bloom catches only it), pull 0..1 drags the cord's bead down. Returns { root, bead, set,
// bulbAt (world), beadAt (world) }.
function lamp(o = {}) {
  o = { h: 2.35, post: '#3B3350', glass: '#FFC46B', light: '#FFB15C', reach: 1.18, cordX: .08, ...o };
  const g = group(o.parent || scene, o.at || [0, 0, 0], o.ry || 0), h = o.h;
  mesh(G.cyl(.13, .16, .12, 20), o.post, { parent: g, at: [0, .06, 0] });
  mesh(G.cyl(.045, .055, h, 14), o.post, { parent: g, at: [0, h / 2, 0] });
  const head = group(g, [0, h, 0]);
  mesh(G.box(.36, .05, .36, .02), o.post, { parent: head, at: [0, .02, 0], line: .8 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(G.box(.035, .38, .035, .012), o.post, { parent: head, at: [x * .15, .22, z * .15], line: .6 });
  const cap = mesh(G.cone(.3, .22, 4), o.post, { parent: head, at: [0, .52, 0], rot: [0, Math.PI / 4, 0] });
  mesh(G.ball(.05, 12, 8), o.post, { parent: head, at: [0, .66, 0], line: .6 });
  const bulbMat = glow(o.glass, 1), bulb = new THREE.Mesh(G.ball(.12, 24, 16), bulbMat); bulb.position.set(0, .22, 0); head.add(bulb);
  const panes = new THREE.Mesh(G.box(.3, .34, .3, .02), new THREE.MeshBasicMaterial({ color: col(o.glass), transparent: true, opacity: .0, depthWrite: false })); panes.position.set(0, .22, 0); head.add(panes);
  const cordLen = h - .02 - o.reach, cord = new THREE.Mesh(G.cyl(.008, .008, 1, 6), new THREE.MeshBasicMaterial({ color: col(S.ink) })); head.add(cord);
  const bead = mesh(G.ball(.045, 16, 12), o.post, { parent: head, line: .7 });
  const light = new THREE.PointLight(col(o.light), 0, o.range || 7, 1.6); light.position.set(0, .2, 0); head.add(light);
  const base = col(o.glass), dim = col(o.post).lerp(col(o.glass), .25);
  function set(on, pull = 0) {
    on = clamp(on); bulbMat.color.copy(dim).lerp(base, Math.min(1, on * 1.5)).multiplyScalar(1 + on * (o.hot ?? 3.2));
    panes.material.opacity = .28 * on; panes.visible = on > .01;
    light.intensity = on * (o.power ?? 9);
    const len = cordLen + pull * (o.pullLen ?? .3); cord.scale.y = len; cord.position.set(o.cordX, -len / 2, 0); bead.position.set(o.cordX, -len, 0);
  }
  set(0, 0);
  return { root: g, head, bead, bulb, light, set, bulbAt: () => worldOf(head, [0, .22, 0]), beadAt: () => worldOf(bead) };
}
// clouds(o): 3D cumulus puffs on a ring around the set (a flat base, 2-4 domes), shaded by cloudMat from the day table.
// Use them near and below the set, where parallax sells depth; far away the painted sky does it better (and a far 3D
// puff under depth of field reads as a sticker). No outlines. Returns { root, drift(t, speed) }.
function clouds(o = {}) {
  o = { n: 12, ring: [55, 110], y: [-14, -6], seed: 21, size: [5, 10], ...o };
  const root = group(o.parent || scene), R = rnd(o.seed), mat = cloudMat, list = [];
  for (let i = 0; i < o.n; i++) {
    const a = (o.arc ? lerp(o.arc[0], o.arc[1], (i + .5) / o.n + (R() - .5) * .08) : R() * 360) * Math.PI / 180, d = lerp(o.ring[0], o.ring[1], R()), s = lerp(o.size[0], o.size[1], R());
    const c = group(root, [Math.sin(a) * d, lerp(o.y[0], o.y[1], R()), Math.cos(a) * d]); c.rotation.y = R() * TAU; list.push({ c, base: c.position.clone(), k: .6 + R() * .8 });
    // a wide flat base, then 2-4 domes standing on it, the biggest near the middle
    mesh(G.ball(1, 36, 20), mat, { parent: c, at: [0, 0, 0], scale: [s * 1.5, s * .42, s * .9], line: false, cast: false, receive: false });
    const m = 2 + Math.floor(R() * 3);
    for (let j = 0; j < m; j++) { const u = m === 1 ? 0 : (j / (m - 1)) * 2 - 1, pr = s * (.48 + .38 * (1 - Math.abs(u)) * (.75 + .5 * R()));
      mesh(G.ball(1, 36, 22), mat, { parent: c, at: [u * s * .85, s * .12 + pr * .45, (R() - .5) * s * .3], scale: [pr, pr * .9, pr * .85], line: false, cast: false, receive: false }); }
  }
  return { root, drift: (t, speed = .25) => { for (const l of list) l.c.position.set(l.base.x + t * speed * l.k, l.base.y + .15 * noise(t * .3, l.k * 9), l.base.z); } };
}

// ---------- the camera stack ----------
// Depth of field, one pass, depth-aware: a golden-angle spiral gather in which each sample counts only if its own blur
// disc reaches the centre pixel, and a sample behind the centre may not be blurrier than twice the centre (after
// Dennis Gustafsson's single-pass bokeh). So the background never bleeds over a sharp subject, and a soft foreground
// still spreads over what is behind it. postprocessing's DepthOfFieldEffect adds its blurred far layer on top of the
// in-focus picture, which ghosts the set through the hero; this replaces it. focus (world distance) and range (world
// units held sharp around it) are set each frame; blur is the largest disc in px at 1080p. The sky (anything past
// farZ, where the depth buffer still holds the clear value) gets at most skyBlur px: a painted backdrop stays nearly
// sharp, so its toon bands and the stars read, while the middle ground still goes soft.
class ToonDof extends Effect {
  constructor(o = {}) {
    super('ToonDof', `uniform float focusDist; uniform float range; uniform float maxBlur; uniform float skyBlur; uniform float farZ;
      float coc( float d ) { float c = maxBlur * clamp( ( abs( d - focusDist ) - range * .5 ) / ( range * 2.5 ), 0., 1. ); return d > farZ ? min( c, skyBlur ) : c; }
      void mainImage( const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor ) {
        float cd = - getViewZ( depth ), cs = coc( cd ); vec3 color = inputColor.rgb; float tot = 1., radius = 1.4;
        for ( int i = 0; i < 160; i ++ ) { if ( radius >= maxBlur ) break;
          float ang = float( i ) * 2.39996323; vec2 tc = uv + vec2( cos( ang ), sin( ang ) ) * texelSize * radius;
          vec3 sc = texture2D( inputBuffer, tc ).rgb; float sd = - getViewZ( readDepth( tc ) ), ss = coc( sd );
          if ( sd > cd ) ss = clamp( ss, 0., cs * 2. );
          color += mix( color / tot, sc, smoothstep( radius - .5, radius + .5, ss ) ); tot += 1.; radius += 1.4 / radius; }
        outputColor = vec4( color / tot, inputColor.a ); }`,
      { attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
        uniforms: new Map([['focusDist', new THREE.Uniform(o.focus ?? 10)], ['range', new THREE.Uniform(o.range ?? 2.6)], ['maxBlur', new THREE.Uniform(o.blur ?? 12)],
          ['skyBlur', new THREE.Uniform(o.sky ?? 1.5)], ['farZ', new THREE.Uniform(o.farZ ?? 300)]]) });
  }
}
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: S.msaa });
composer.addPass(new RenderPass(scene, camera));
const dof = new ToonDof({ range: S.dof.range, blur: (S.dof.blur ?? 12) * H / 1080, sky: (S.dof.sky ?? 1.5) * H / 1080 });
const bloom = new BloomEffect({ luminanceThreshold: S.bloom.threshold, luminanceSmoothing: S.bloom.smoothing, intensity: S.bloom.intensity, radius: S.bloom.radius, mipmapBlur: true });
const vignette = new VignetteEffect({ offset: S.vignette.offset, darkness: S.vignette.darkness });
const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }); grain.blendMode.opacity.value = S.grain;
const dofPass = new EffectPass(camera, dof), finalPass = new EffectPass(camera, bloom, vignette, grain);
finalPass.dithering = true;
composer.addPass(dofPass); composer.addPass(finalPass);
composer.setSize(W, H, false);

// ---------- the frame ----------
const updates = [];
function render(t) {
  for (const u of updates) u(t);
  sky.position.copy(camera.position);
  moon.position.copy(SUN.target).addScaledVector(_moonDir, 40); moon.target.position.copy(SUN.target); moon.target.updateMatrixWorld();
  // the rim follows whichever key is stronger: the warm sun's at golden hour, the cool moon's at dusk
  const sw = Math.min(1.2, sun.intensity / 2.4), mw = moon.intensity * (S.moonRim ?? .3);
  RIM.dir.value.copy(_sunDir).multiplyScalar(sw + 1e-4).addScaledVector(_moonDir, mw).normalize().transformDirection(camera.matrixWorldInverse);
  RIM.col.value.copy(sun.color).multiplyScalar(sw).add(_c.copy(moon.color).multiplyScalar(mw));
  LINE.value = S.line * (H / 1080) / ((H / 2) / Math.tan(camera.fov * Math.PI / 360));
  dof.uniforms.get('focusDist').value = FOCUS.dist; dof.uniforms.get('range').value = S.dof.range * (FOCUS.range || 1);
  finalPass.fullscreenMaterial.time = 1 + 3 * hash(Math.round(t * FPS) + 1);   // grain seed from the frame index, never a clock
  composer.render(0);
  CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.drawImage(canvas, 0, 0, W, H); CX.restore();
}

const skyDrift = r => { sky.material.uniforms.drift.value = r; };
// skyClouds(o): reshape the painted clouds. bank: [far base, far height, near base, near height] (radians of elevation);
// towers: [azimuth 1, azimuth 2 (radians from the sun), height 1, height 2]; streaks: 0..1 high cloud
function skyClouds(o = {}) { const U = sky.material.uniforms; if (o.bank) U.bank.value.set(...o.bank); if (o.towers) U.towers.value.set(...o.towers); if (o.streaks != null) U.streaks.value = o.streaks; }
const K = { THREE, scene, cloudMat, rim, RIM, skyDrift, skyClouds, cam: camera, renderer, composer, dof, bloom, vignette, grain, sun, moon, hemi, sky, G, toon, glow, mesh, group, outline,
  sunAt, moonAt, daylight, camera: setCamera, project, worldOf, focus: FOCUS, mascot, face, paintFace, FACE_KEYS, island, tree, bush, bench, lamp, clouds, LINE };
TOON.K = K; TOON._render = render;

// ---------- build, warm up, open the gate ----------
try {
  for (const b of TOON.builders) { const u = b(K); if (typeof u === 'function') updates.push(u); }
  for (const u of updates) u(0);
  renderer.compile(scene, camera);
  composer.render(0);   // compiles the post shaders and uploads every texture before frame 0
  TOON._ok();
} catch (e) {
  console.error('toon3d: building the scene failed: ' + (e && e.stack || e));
  TOON._fail(e);
}
