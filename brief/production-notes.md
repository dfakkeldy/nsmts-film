# Production notes (2026-10-09)

How the film was made, and every place where what's on screen depends on something other than a plain live
recording. The takes are recordings of the live site, kinnokilabs.com, made in this container's headless Chromium
(version 141) on 2026-10-09.

## Takes

| Take | What it shows | How it was recorded | In the film |
|---|---|---|---|
| R1 | 5471 Highway 19 searched, PID 50169663's sheet scrolling through its checks | frame-controlled, 1920 x 1080 | 30.6-39.6 s, with a loupe on "No mapped water feature intersects this parcel." |
| R2 | Fletcher sheet 16 in the georeferencer: residuals, point 4 off most (180 m), curved warp, a drag and Undo | step capture | 45.8-54.1 s, loupe on point 4's row |
| R3 | The Fletcher sheets on 3D terrain over the Mabou Highlands (zoom 14), height exaggeration 10x (the slider's maximum, Dan's preference), a slow turn west | step capture, browser cache off (see below) | 54.1-57.6 s, cropped to the ridges; the plate notes "Heights exaggerated 10×" |
| RG | Fletcher sheet 19's "Gold Mine" beside Glendale Brook (reviewed feature F19-JUD-094): the label on hover, zoom 14 to 15, the popup with the scan excerpt | frame-controlled | 57.6-62.9 s, the zoom drawn in the film (see below), pushed in on the popup |
| R4 | Inverness micro-hydro screen: Margaree R. reach popup | frame-controlled | 62.9-66.3 s, pushed in on the popup |
| R5 | Rhodena turbine visibility, viewpoint at Long Point: 2 of 6 tips potentially visible | step capture | 66.3-69.5 s |
| R6 | Export map (PDF) over the Mabou Highlands: frame drag, the dialog, "Mabou Highlands, 1884" typed, Download | frame-controlled | 69.5-72.1 s (sped up; the wait between framing and dialog is cut; cropped above the sheets' join at the map's foot) |
| R7 + R8 | Phone, one session in the Mabou Highlands: an exported GeoPDF of the highlands imported (frame chooser), the location dot on it; Mark my location; Add photos to map; Record a track; the layer list with export buttons | step capture, phone size | 72.1-81.4 s, as six short clips with wipes |
| R9 | Poker on the phone: 5471 Highway 19, aerial, driveway trace (36.2 m, within 500 m), offline reload | step capture, phone size | 81.4-91.5 s, as three clips |

Frame-controlled capture stalls on modal dialogs, the georeferencer panel, the Rhodena page and the 3D view, so those
were step-captured: one screenshot per recorded frame, with the page running in real time.

## What was emulated or adjusted, and why

- **Location** (R7, R8): emulated on the public road between Mabou Coal Mines and MacDonalds Glen (46.1264 N,
  61.4593 W). The short track in R8 is an emulated walk north along it, about 17 m a step (a faster first try had a
  fix rejected by the app as "too far from the one before it to have been walked"). No real person's location is
  recorded.
- **Airplane mode** (R9): the network was cut in the browser (offline emulation), then the page reloaded. Poker had
  been saved for offline use first (Map options > Save offline), as a user does. The film labels this "Network off
  (airplane mode)".
- **The photo** (R8): "Salt-diapir-Cape-Breton 022.JPG" (Coal Mine Point, near Mabou Mines) by Michael C. Rygel,
  CC BY-SA 3.0, from Wikimedia Commons, with its recorded camera position and capture time written into its EXIF so
  "Add photos to map" can place it. The film shows only its filename and its point, not the image.
- **GeoPDF import** (R7): PDF.js 6, which the import uses, calls `Map.prototype.getOrInsertComputed`; this
  container's Chromium 141 predates it, so the import failed here with "This PDF could not be read". Current
  browsers ship the method. The recording adds the standard behaviour of that one method to the app's scripts as
  they load (`capture/shim-upsert.mjs`); nothing else changes. Dan confirmed GeoPDF import works on his iPhone.
- **3D terrain** (R3): recorded with the browser cache off. With the cache on, tiles the 2D map had already loaded fail
  in 3D (see "Site issues" below).
- **Cuts inside takes**: R6's wait between framing and the dialog; R7's zoom (the software renderer draws the
  location dot at full map scale until the zoom settles, about 2 s); a blank frame mid-scroll in R8; R9's typing,
  whose suggestion list briefly shows other real addresses.
- **Blurred**: neighbours' civic numbers on the aerial in R9 (every label except 5471), per the brief.

## Checked

- The exported PDF is a real GeoPDF: `gdalinfo` reads it as Geospatial PDF, Mercator, 1650 x 1275 px.
- "More than a hundred layers": 109 layer toggles on the live map with every category open (108 not counting the
  tax-sale switch), 2026-10-09.
- Data plate endpoints come from the app's own source: `nsgiwa.novascotia.ca` (ArcGIS REST, Province licence),
  `data.novascotia.ca/resource/<id>.geojson` (Socrata, OGL - Nova Scotia), `geo.weather.gc.ca/geomet` (OGC WMS,
  ECCC end-use licence), `services5.arcgis.com` Plan Inverness zoning (licence recorded as none stated).
- Poker offline: "Saved for offline use", then offline reload shows "Offline · Atlas" and "Offline · using saved Atlas
  map and addresses"; the aerial is not offline.
- The Nova Scotia outline on the data plate is Natural Earth 1:50m (public domain); the earlier riding-union outline
  showed riding lines and limits at sea, and was replaced.

## Site issues found while recording

1. **Fletcher tiles fail in 3D after 2D.** tiles.kinnokilabs.com answers a request without an Origin header with no
   `Access-Control-Allow-Origin` and no `Vary: Origin`, but a year-long `immutable` cache. The 2D map loads Fletcher
   tiles as plain images, so the 3D view's CORS fetch of the same URL gets the cached copy and fails ("Map source
   leaf-26 failed to load · Retry 3D"). Fix: `crossOrigin: 'anonymous'` on the Fletcher tile layers
   (`web/src/components/FletcherTileLayer.tsx`, `FletcherFullSheetsPreview.tsx`), or `Vary: Origin` on every tile
   response.
2. **GeoPDF import needs `Map.prototype.getOrInsertComputed`** (above): worth a polyfill in the app for older
   browsers.
3. `/vendor/pdfjs/6.1.200/standard_fonts/*.pfb` return 404 on the live site (the `.ttf` files load). PDF.js falls
   back without them; it didn't affect the import here.

## The move to the Mabou Highlands (Dan, 2026-10-09)

Dan's notes on the first cut: the gap at the join between Fletcher sheets 16 and 14 (just north of Mabou village)
"looks terrible"; the green-striped units make the map hard to read; the orange areas look good. The Fletcher scenes
moved to the Mabou Highlands on sheet 14 ("Cape Mabou / Broad Cove", 1884), framed clear of the sheets' joins: the
cold open (46.158 N 61.36 W, zoom 13), R3 (zoom 14, turning west, away from the east join near 61.225 W), R6 (cropped
above the join) and the GeoPDF in R7 (46.090-46.211 N, no join inside). The narration still says "Mabou"; the
captions say "Mabou Highlands". The georeferencing plate and R2 still show sheet 16's scan, as the document itself.

## The gold-mine insert (Dan, 2026-10-09)

Dan asked for a few seconds on "a feature that you wouldn't know existed without the Fletcher maps", suggesting "a
gold mine in Glendale". Sheet 19 (1884) has two "Gold Mine" marks in the app's reviewed features layer:

- **F19-JUD-061** (the one in Dan's screenshot, with the Quartz Mill): about 1 km from today's Melford, by Fletcher's
  "River Denys Road"; about 10 km from Glendale. Not used.
- **F19-JUD-094** (used): "west of the curving road and Glendale Brook"; Fletcher's own "Glendale" label is 2.6 km to
  the south-east and his "Glendale Brook" label 1.2 km. Dan corroborated this locality in the placement pilot
  (September 6). Nearby provincial records, kept as candidates only (reports/fletcher/placement-pilot in the app
  repo): an unnamed gold shaft, Abandoned Mine Openings GBG-1-001, about 40 m away, and the "Camerons Mountain Au, As,
  Pb, Cu" occurrence, MODB F14-017. So the narration says "near Glendale", and the caption names Glendale Brook. The
  popup itself says "Approximate historical location".

Two bars (5.33 s at 90 BPM) open at 57.6 s, between R3 and R4; everything after moves two bars later, so the cuts stay
on the bar lines (film length 101.33 s). The score now lists its chords bar by bar: the first cut's I-vi-IV-V cycle,
with IV-V as the two new bars, so the chords after the insert are the ones the first cut had there.

The take is framed with the mark lower right, which keeps the green-striped unit south-east of it and the
cross-hatched unit to the north-west almost out of view. Leaflet ends its zoom animation on a real-time timer, and
frame-controlled capture renders more slowly than real time, so the take jumps from zoom 14 to 15 in one frame. The
film draws the zoom as Leaflet does: the zoom-14 picture scaled 2x about the mark over 0.3 s (Leaflet's curve), then
the zoom-15 frames, cropped to the same ground.

The line, "Here's something interesting. Did you know there was a gold mine near Glendale?", is take 1 of four in
Dan's cloned voice (credits ledger), placed at 57.95 s: "interesting" falls on the zoom, the popup opens on "Did you
know". On 2026-10-09 Dan reported the gap fix live; a fresh browser on the live site shows the sheet 16/14 join near
Mabou (46.09 N) without a gap. The highlands framing stays, since Mabou village itself sits in the green-striped unit.

## Decisions (Dan, 2026-10-09)

- **3D terrain**: Dan prefers the exaggeration turned right up, so R3 is recorded at 10x (3D settings > Terrain height >
  Height exaggeration, set before recording; the app doesn't keep it between visits). Because 10x is not true
  relief, the plate carries "Heights exaggerated 10×" while R3 is on screen.

- **GeoPDF import on iPhone**: works on Dan's iPhone, so "Bring GeoPDFs in too" stands.
- **Voice credit**: dropped from the end card.
- **ElevenLabs terms**: Dan's plan allows commercial use of the narration.
- **Province imagery**: the permission covers the portfolio video; the end card keeps "Province of Nova Scotia
  (licensed services)".
