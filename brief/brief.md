# Brief: NS Marks The Spot portfolio film

- **Who:** Dan Fakkeldy. Logo: KinNoKi Labs (circuit tree, gold and silver; files in `../assets/kinnoki/`,
  fetched 2026-10-08 from kinnokilabs.com/images/brand/: logo-mark.png for dark grounds, logo-mark-light.png for
  light grounds, logo.png lockup with wordmark on black).
- **Where it plays:** portfolio for people hiring remote GIS work (portfolio page, LinkedIn, Upwork-style profiles).
  Must work muted; captions carry it.
- **Length and aspect:** main cut about 2:30, 16:9. A 60 s cut from scenes 1, 2, 4, 6, 7, 8 + end card.
  Phone footage is 9:16 inside a 16:9 frame (re-laid, never cropped).
- **The claim:** Dan knows where Nova Scotia's GIS data lives, how to query it and what its licence allows, and he
  builds tools people use in the field.
- **Order:** web app first (desk work, then field work), then "also an iOS app" at the end.
- **Footage:** Dan records desktop screen captures and phone screen recordings himself; deep links per shot are in
  the plan. Code-drawn pieces: title, chapter plates, "where the data lives" diagram, georeferencing explainer,
  iOS reveal, end card.
- **Sound (Dan, 2026-10-08):** narration in Dan's own cloned voice from ElevenLabs ("Dan 1", category cloned,
  in Dan's workspace). Price each generation first, ask before every paid run, ledger every file. Captions on screen
  too (muted viewing). A music bed under the voice, ducked; silence before the signature.
- **End card (Dan, 2026-10-08):** kinnokilabs.com and kinnokilabs.com/map, plus the KinNoKi Labs logo.
- **Project:** ~/Developer/nsmts-film in the cloud container (temporary until it has a git remote).
- **Deadline:** none given.

## Scenes (running order, about 2:35)

1. Cold open: Fletcher 1884 sheet over Mabou wipes to today; title.
2. Where the data lives: sources and protocols; "100+ layers" (108 shareable layer IDs counted 2026-10-08).
3. Parcel research (desktop, then the phone match cut).
4. Georeferencing (hero): control points, residuals, curved warp (TPS), Allmaps export; then the 24-sheet mosaic in 3D.
5. Hydro and viewshed analysis.
6. GeoPDF out, take it to the field (external checks still unrun: verify in QGIS, Avenza, gdalinfo before captioning).
7. In the field on the phone: mark, photo, track, save, export KMZ; Add photos to map.
8. Poker (true story, C2-C10): 5471 Highway 19; trace; aerial online; staged miss 5474; airplane-mode reload;
   "Built for whoever starts next".
9. iOS: "Also an iOS app (SwiftUI + MapKit). In TestFlight."
10. End card: Dan Fakkeldy, KinNoKi Labs logo, links, credits (David Rumsey Map Collection, CC BY-NC-SA 3.0; Province
    licence line; OpenStreetMap).

## Truth constraints (checked against code or live site, 2026-10-08)

- Main web map is not offline (no service worker; offline reload fails). Poker is (service worker at /poker,
  "Saved for offline use", offline reload shows "Offline · Atlas"). Aerial is never offline (Province licence).
- Track recording continued with the network cut in a simulated run; web recording is foreground only.
- Fletcher *style* is modern geography in 1884 colours, not a historical map. Viewshed is preliminary bare-earth.
  Hydro is a screening scale. Parcel boundaries are not a survey. iOS app is in TestFlight, not the App Store.
- Poker "No match in this saved address list." is not proof an address doesn't exist (PokerApp.tsx:283).
- 5471 Highway 19: in both the NAR postal list (B0E 1P0) and the provincial civic file.

## Never show

Real customers' addresses or homes (blur neighbours' civic numbers on aerial), mail, the inside of the post office,
employer logos, uniform or vehicle markings, the satellite dish's branding, faces other than Dan's, coworkers without
consent, a private home's assessed value, invented UI, unshipped features (main-map offline, offline aerial).
