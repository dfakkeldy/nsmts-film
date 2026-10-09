# Builds assets/geo/ns-outline.js from Natural Earth's 1:50m admin-1 provinces (public domain):
#   python3 -I scripts/build-ns-outline.py <ne_50m_admin_1_states_provinces.geojson>
# from https://github.com/nvkelso/natural-earth-vector (geojson/). Nova Scotia's outer rings, equirectangular at
# 45.2 N, 1000 units wide, y down.
import json, math, sys
g = json.load(open(sys.argv[1]))
f = next(f for f in g['features'] if f['properties'].get('name') == 'Nova Scotia' and f['properties'].get('admin') == 'Canada')
geom = f['geometry']; polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
rings = [p[0] for p in polys]
lons = [c[0] for r in rings for c in r]; lats = [c[1] for r in rings for c in r]
lon0, lat0, k = min(lons), max(lats), math.cos(math.radians(45.2))
s = 1000 / ((max(lons) - lon0) * k)
out = [[[round((lon - lon0) * k * s, 1), round((lat0 - lat) * s, 1)] for lon, lat in r] for r in rings]
h = round((lat0 - min(lats)) * s, 1)
open('assets/geo/ns-outline.js', 'w').write(
  "// Nova Scotia from Natural Earth 1:50m admin-1 states and provinces (public domain, naturalearthdata.com),\n"
  "// built by scripts/build-ns-outline.py. Outer rings, equirectangular at 45.2 N, 1000 units wide, y down.\n"
  f"const NS_BOX = [1000, {h}];\n"
  f"const NS_LONLAT = {{ lon0: {lon0}, lat0: {lat0}, k: {k:.6f}, s: {s:.5f} }};\n"
  f"const NS_OUTLINE = {json.dumps(out, separators=(',', ':'))};\n")
print(len(out), [len(r) for r in out], 'box', 1000, h)
