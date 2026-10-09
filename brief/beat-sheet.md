# Beat sheet v1 (2026-10-09), for Dan's review before building

**Grid:** 1920 x 1080, 30 fps, 90 BPM (20 frames a beat), 36 bars = 96.0 s. Bar n starts at (n - 1) x 2.667 s.

**Voice:** narration v1.2 (84.1 s) placed on the film with breathing room: +0.40 s at the start, +2.37 s after
the cold open (title), +1.0 s after georeferencing, +0.5 s before the pocket map, +0.5 s before the iPhone line.
Layout: `sound/voice-layout.json`. Film-time word timings: `sound/words/film-v2.json` (written by scripts/place-voice.py; the first cut used film-v1.json).

**Grammar:** a book of numbered plates on Fletcher paper (the `plates` look). Code-drawn figures, and Dan's
recordings shown as figures inside engraved frames (desktop) or an engraved phone outline (phone). The paper never
cuts; it turns. One survey mark (a control-point cross) carries through and lands on Dan's name.

**Text:** narration subtitles at the foot of every frame (captions `subtitle` mode, from the word timings). One FIG.
caption per plate at the top left, two to four words, one exact fact.

**Sources:** [plate] drawn in code; [still] stills captured from the live map; [Dan] Dan's own recording.

| Film time | Bar | Voice | Picture | Source | FIG. caption | Sound |
|---|---|---|---|---|---|---|
| 0.00-3.76 | 1.1 | This is Mabou in the 1880s, as Hugh Fletcher surveyed it. | Fletcher sheet over Mabou fills the plate; the frame draws in | [still] | FIG. 1 Mabou, 1880s | bed enters, low |
| 3.84-6.28 | 2.2 | And this is Mabou today. | A wipe reveals today's Atlas map in the same frame, landing on "today" (5.4) | [still] | FIG. 1 Mabou, 1880s · today | soft paper slide on the wipe |
| 6.56-10.56 | 3.2 | I'm Dan Fakkeldy, and I built NS Marks The Spot to put them on the same map. | The two halves settle side by side; the survey mark pins them together on "same map" | [still] + [plate] | | engraved tick on the pin |
| 10.56-13.33 | 5.1 | (none) | Title: NS MARKS THE SPOT, engraved | [plate] | | bed swells, one chord |
| 13.33-21.57 | 5.4 | Nova Scotia publishes a lot of map data, but it's scattered: provincial ArcGIS services, open data portals, federal and municipal servers. | Nova Scotia engraved; source endpoints appear around it one per named kind, each with its own leader line | [plate] | FIG. 2 Where the data lives | a soft tick per endpoint |
| 21.97-25.61 | 9.1 | I know where it lives, how to query it, and what each licence allows. | Each endpoint gets its protocol (ArcGIS REST, Socrata, OGC WMS) and a licence tag | [plate] | FIG. 2 Queried live | |
| 25.81-30.97 | 10.3 | The map draws on more than a hundred layers, and every one keeps its source and licence on screen. | The lines draw into the map; "100+ layers" lands on "hundred" (27.1) | [plate] | FIG. 2 100+ layers, each cited | |
| 31.17-39.89 | 12.3 | Pick a parcel and it checks roads, water, buildings, civic addresses and assessments, each against its own source, and it tells you when a source comes back empty. | Parcel picked on aerial; the parcel sheet fills in row by row; an empty-result row on "empty" | [Dan] R1 | FIG. 3 One parcel, many sources | page turn in |
| 39.97-41.81 | 15.4 | Georeferencing is the heart of it. | An old scan and today's map side by side | [plate] | FIG. 4 Georeferencing | page turn |
| 41.93-46.05 | 16.3 | Drop in a scan, match a few landmarks, and it drapes onto today's map. | Three survey marks pair landmarks across the two; the scan drapes into place (no numbers drawn) | [plate] | FIG. 4.1 Three landmarks | a tick per pair |
| 46.21-50.05 | 18.2 | Every point shows how well it fits, and which one disagrees with the rest. | The real georeferencer: the points list with its residuals and the point that disagrees | [Dan] R2 | FIG. 4.2 Residuals | |
| 50.13-54.05 | 19.4 | Hand-drawn maps bend, so a curved warp passes through every point. | Switch to Curved warp (TPS), drag a point, the drape re-warps live | [Dan] R2 | FIG. 4.3 Curved warp | |
| 54.09-57.09 | 21.2 | That's how twenty-four of Fletcher's sheets got onto the map. | The Fletcher mosaic draped on 3D terrain, a slow turn | [Dan] R3 | FIG. 4.4 24 Fletcher sheets | |
| 57.09-58.13 | 22.1 | (breath) | Page turns | [plate] | | paper |
| 58.13-61.0 | 22.4 | It also screens rivers for small hydro, | Micro-hydro reaches; a reach's popup | [Dan] R4 | FIG. 5 Small-hydro screening | |
| 61.0-64.17 | 23.4 | and shows where a proposed wind farm could be seen from, on bare earth. | Rhodena viewshed; a viewpoint's sight lines | [Dan] R5 | FIG. 5 Bare-earth viewshed | |
| 64.29-67.09 | 25.1 | Frame a map and export a georeferenced PDF. | Export frame dragged (scale readout), Continue, download | [Dan] R6 | FIG. 6 GeoPDF out | |
| 67.29-70.33 | 26.1 | Bring GeoPDFs in too, and see where you are on them. | On the phone: a GeoPDF loaded, the location dot on it | [Dan] R7 (phone) | FIG. 6 GeoPDF in | |
| 70.37-75.61 | 27.2 | On a phone, it logs points, photos and tracks. It all stays on the device until you export it. | Mark a point, attach a photo, the recording card | [Dan] R8 (phone) | FIG. 7 Field log | |
| 75.61-76.39 | 28.4 | (breath) | Page turns to the phone figure | [plate] | | |
| 76.39-78.79 | 29.3 | I also built a pocket map for my day job. | Poker opens; search 5471 Highway 19 | [Dan] R9 (phone) | FIG. 8 Pocket map | |
| 78.95-81.27 | 30.3 | It finds an address and measures the driveway. | The map flies to it; trace door to road; "Within 500 m" | [Dan] R9 | FIG. 8 Driveway measured | |
| 81.67-85.64 | 31.3 | There's no signal at work, so it runs offline, and my coworkers use it too. | Airplane mode, reload, "Offline · Atlas" | [Dan] R9 | FIG. 8 Offline | |
| 86.41-88.97 | 33.2 | It's also a native iPhone app, in TestFlight. | The iPhone app in an engraved phone outline, Atlas Fletcher style | [Dan] R10 (iPhone) | FIG. 9 iPhone, in TestFlight | |
| 88.97-89.80 | 34.1 | (silence) | The plate clears to paper | [plate] | | music drops out |
| 89.33 | 34.3 | | The survey mark draws and lands on DAN FAKKELDY | [plate] | | one engraved tick, a held chord |
| 90.67 | 35.1 | | GIS · web mapping · field tools; the KinNoKi Labs mark | [plate] | | |
| 91.33-96.00 | 35.2 | | kinnokilabs.com · kinnokilabs.com/map; credits in small type; hold | [plate] | | chord fades by 96.0 |

**End-card credits (small type):** Hugh Fletcher sheets: David Rumsey Map Collection, David Rumsey Map Center,
Stanford University Libraries, CC BY-NC-SA 3.0. Contains information licensed under the Open Government Licence -
Nova Scotia; Province of Nova Scotia (licensed services). Map data © OpenStreetMap contributors. Voice: Dan Fakkeldy
(open question: say it's an ElevenLabs voice clone).

## Recordings Dan makes (each with about 2 s of handles either side)

Desktop captures at 1920 x 1080, browser at 100 % zoom, licence accepted beforehand, each view loaded once before
recording. Phone captures with the phone's own screen recording.

| # | Length on screen | What | Where |
|---|---|---|---|
| R1 | 8.7 s | Search a public place, the parcel on aerial, the sheet filling in; ideally a source answering empty | Main map, a public parcel (park, school, municipal building) |
| R2 | 7.8 s | Georeferencer: points list with residuals and the "Disagrees most" flag; switch to Curved warp (TPS); drag a point | `?theme=georeferencing` with a hand-drawn scan |
| R3 | 3.0 s | Fletcher on 3D terrain at Mabou, a slow turn | `?basemap=day&taxSale=off&layers=modern,fletcher&position=46.07,-61.39,13`, then 3D terrain |
| R4 | 2.9 s | Micro-hydro reaches, click one | `?basemap=day&taxSale=off&layers=modern,inverness-hydro-potential` |
| R5 | 3.2 s | Viewshed on, choose a viewpoint, sight lines | kinnokilabs.com/rhodena |
| R6 | 2.8 s | Export map (PDF): drag the frame, Continue, Download | Main map |
| R7 | 3.0 s | Phone: load a GeoPDF, show your location on it | Main map on the phone (test first) |
| R8 | 5.2 s | Phone: Mark my location, attach a photo, Record a track card | Main map on the phone, somewhere public |
| R9 | 9.3 s | Phone, outdoors at 5471 Highway 19: search, trace, airplane mode, reload, "Offline · Atlas" | kinnokilabs.com/poker |
| R10 | 2.6 s | iPhone app: the Atlas Fletcher style, a pan | the TestFlight build |

Never show: neighbours' civic numbers (frame tight or blur), mail, the post office inside, employer marks, other
people's faces, the satellite dish's branding, a private home's assessment.

## Checks before final

- R7: GeoPDF import and the location dot work on the phone.
- The "voice clone" credit line: Dan to decide.
- ElevenLabs plan's commercial terms (ledger rule).
