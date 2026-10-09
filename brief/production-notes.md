# Production notes (2026-10-09)

How the film was made, and every place where what's on screen depends on something other than a plain live
recording. The takes are recordings of the live site, kinnokilabs.com, made in this container's headless Chromium
(version 141) on 2026-10-09.

## Takes

| Take | What it shows | How it was recorded | In the film |
|---|---|---|---|
| R1 | 5471 Highway 19 searched, PID 50169663's sheet scrolling through its checks | frame-controlled, 1920 x 1080 | 30.6-39.6 s, with a loupe on "No mapped water feature intersects this parcel." |
| R2 | Fletcher sheet 16 in the georeferencer: residuals, point 4 off most (180 m), curved warp, a drag and Undo | step capture | 45.8-54.1 s, loupe on point 4's row |
| R3 | The Fletcher sheets on 3D terrain at Mabou, a slow turn | step capture, browser cache off (see below) | 54.1-57.6 s |
| R4 | Inverness micro-hydro screen: Margaree R. reach popup | frame-controlled | 57.6-61.0 s, pushed in on the popup |
| R5 | Rhodena turbine visibility, viewpoint at Long Point: 2 of 6 tips potentially visible | step capture | 61.0-64.2 s |
| R6 | Export map (PDF): frame drag, the dialog, title typed, Download | frame-controlled | 64.2-66.8 s (sped up; the wait between framing and dialog is cut) |
| R7 + R8 | Phone, one session at Mabou: the exported GeoPDF imported (frame chooser), the location dot on it; Mark my location; Add photos to map; Record a track; the layer list with export buttons | step capture, phone size | 66.8-76.1 s, as six short clips with wipes |
| R9 | Poker on the phone: 5471 Highway 19, aerial, driveway trace (36.2 m, within 500 m), offline reload | step capture, phone size | 76.1-86.2 s, as three clips |

Frame-controlled capture stalls on modal dialogs, the georeferencer panel, the Rhodena page and the 3D view, so those
were step-captured: one screenshot per recorded frame, with the page running in real time.

## What was emulated or adjusted, and why

- **Location** (R7, R8): emulated at Mabou village on Route 19 (46.0712 N, 61.3928 W), a public road. The short
  track in R8 is an emulated walk of about 160 m toward the church. No real person's location is recorded.
- **Airplane mode** (R9): the network was cut in the browser (offline emulation), then the page reloaded. Poker had
  been saved for offline use first (Map options > Save offline), as a user does. The film labels this "Network off
  (airplane mode)".
- **The photo** (R8): "Church of Mabou, Nova Scotia, Canada" by Miguel Tremblay, CC0, from Wikimedia Commons, with
  its recorded camera position and capture time written into its EXIF so "Add photos to map" can place it.
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

## Decisions (Dan, 2026-10-09)

- **GeoPDF import on iPhone**: works on Dan's iPhone, so "Bring GeoPDFs in too" stands.
- **Voice credit**: dropped from the end card.
- **ElevenLabs terms**: Dan's plan allows commercial use of the narration.
- **Province imagery**: the permission covers the portfolio video; the end card keeps "Province of Nova Scotia
  (licensed services)".
