# Route imagery brief — fal.ai generation list + sizing

_2026-08-23. Decision: generate 2–3 images per **destination** (not per deal) and reuse them everywhere a deal for that destination appears. 96 destination cities (101 airports) across 41 countries in the 159-route network (`skrendam/airports.json` is canonical). Origins (VNO/KUN/RIX/TLL/PLQ) need no destination image; Vilnius/Kaunas/Riga get a city tile each for the collections grid._

## Where images appear and what size to generate

All slots use `object-fit: cover` behind the `.yip-photo--protect` gradient, so **one landscape master per image is enough** — the site crops. Generate at the master size; serve resized (Next `<Image>` or pre-resized WebP) — never ship 2048px into a 160px card.

| Slot | Rendered box (desktop / mobile) | Aspect | Master to generate | Notes |
|---|---|---|---|---|
| Deal-detail hero (`.himg`) | 1412×240 / 358×240 | ~6:1 panorama, crops to 3:2 on mobile | **2048×1024 (2:1)** | Widest crop; keep the subject in the middle 60% so both crops work |
| Home hero photo (`.hero-photo`) | 612×328 / 358×180 | ~2:1 | same 2048×1024 master | Subject mid-frame, sky/sea at top (headline sits bottom-left on the gradient) |
| Featured ticket (`.feat .ph`) | 670×230 / 358×160 | ~3:1 → 2:1 | same master | |
| Ticket card (`.deal .ph`) | 450×160 / 358×160 | ~2.8:1 → 2.2:1 | same master | Eyebrow top-left, city name bottom-left |
| Collection tile (`.ctile`) | 460×104 / 170×104 | 4.4:1 → 1.6:1 | same master (or `--duotone` treatment) | Origin-city tiles (Vilnius/Kaunas/Riga) + moment tiles (September sun, Christmas markets) |
| Past-fares mini | 450×96 | ~4.7:1 | same master | |
| Weekly digest email (Workstream B) | 600×300 | 2:1 | same master, export 1200×600 | Email clients: baked-in gradient, no CSS overlay |
| TikTok / Reels cover | 1080×1920 | 9:16 | **separate 1024×1792 portrait master** | Can't be cropped from landscape — generate a second orientation for the ~30 core destinations only |
| Instagram feed | 1080×1350 | 4:5 | crop from the portrait master | |

**So: one 2048×1024 landscape master per image for the site + email; a 1024×1792 portrait master only for core destinations (TikTok/IG).** fal.ai FLUX models accept `image_size: {width, height}` directly; 2048×1024 and 1024×1792 are both within FLUX limits.

**File naming:** `public/photos/{IATA}-{1,2,3}.webp` (+ `{IATA}-v-{1,2}.webp` for portrait). The `Photo` component already takes a `src` prop; `sceneClass()` in `site/src/lib/photos.ts` becomes the fallback when no file exists.

## Prompt recipe (brand: warm, golden hour, sun/sea, no people close-up, no text, no logos)

```
{City}, {Country}, {signature scene}, golden hour, warm amber light, editorial travel photography, 35mm, soft haze, no people in foreground, no text, no watermark --ar 2:1
```

Three variants per destination: (1) the postcard landmark, (2) coast/nature or a street at dusk, (3) a detail shot (food, harbour, rooftops) — so the same destination doesn't look identical across the home hero, ticket, and detail page.

## Destination list (grouped by country)

_Mark ✦ = worth a portrait (TikTok) master too — suggested: the 29 core routes' destinations; confirm against `routes.core` in the DB._

### Albania (1)
- **Tirana** `TIA`

### Armenia (1)
- **Yerevan** `EVN`

### Austria (1)
- **Vienna** `VIE`

### Belgium (1)
- **Brussels** `BRU` `CRL`

### Bulgaria (2)
- **Burgas** `BOJ`
- **Sofia** `SOF`

### Croatia (2)
- **Dubrovnik** `DBV`
- **Split** `SPU`

### Cyprus (2)
- **Larnaca** `LCA`
- **Paphos** `PFO`

### Czechia (1)
- **Prague** `PRG`

### Denmark (2)
- **Billund** `BLL`
- **Copenhagen** `CPH`

### Egypt (2)
- **Hurghada** `HRG`
- **Sharm El Sheikh** `SSH`

### Finland (4)
- **Helsinki** `HEL`
- **Oulu** `OUL`
- **Tampere** `TMP`
- **Turku** `TKU`

### France (3)
- **Grenoble** `GNB`
- **Nice** `NCE`
- **Paris** `BVA` `CDG`

### Georgia (3)
- **Batumi** `BUS`
- **Kutaisi** `KUT`
- **Tbilisi** `TBS`

### Germany (11)
- **Berlin** `BER`
- **Cologne** `CGN`
- **Dortmund** `DTM`
- **Düsseldorf** `DUS`
- **Frankfurt** `FRA`
- **Frankfurt Hahn** `HHN`
- **Hamburg** `HAM`
- **Memmingen** `FMM`
- **Munich** `MUC`
- **Nuremberg** `NUE`
- **Weeze** `NRN`

### Greece (5)
- **Athens** `ATH`
- **Corfu** `CFU`
- **Crete** `HER`
- **Rhodes** `RHO`
- **Thessaloniki** `SKG`

### Hungary (1)
- **Budapest** `BUD`

### Iceland (1)
- **Reykjavík** `KEF`

### Ireland (2)
- **Dublin** `DUB`
- **Shannon** `SNN`

### Israel (1)
- **Tel Aviv** `TLV`

### Italy (9)
- **Bari** `BRI`
- **Bergamo** `BGY`
- **Catania** `CTA`
- **Milan** `MXP`
- **Naples** `NAP`
- **Pisa** `PSA`
- **Rome** `CIA` `FCO`
- **Treviso** `TSF`
- **Turin** `TRN`

### Japan (1)
- **Tokyo** `NRT`

### Malta (1)
- **Malta** `MLA`

### Moldova (1)
- **Chișinău** `RMO`

### Montenegro (1)
- **Podgorica** `TGD`

### Morocco (1)
- **Marrakech** `RAK`

### Netherlands (2)
- **Amsterdam** `AMS`
- **Eindhoven** `EIN`

### Norway (2)
- **Bergen** `BGO`
- **Oslo** `OSL`

### Poland (3)
- **Gdańsk** `GDN`
- **Kraków** `KRK`
- **Warsaw** `WAW`

### Portugal (3)
- **Faro** `FAO`
- **Lisbon** `LIS`
- **Madeira** `FNC`

### Romania (1)
- **Bucharest** `OTP`

### Serbia (1)
- **Belgrade** `BEG`

### Slovenia (1)
- **Ljubljana** `LJU`

### Spain (7)
- **Alicante** `ALC`
- **Barcelona** `BCN`
- **Gran Canaria** `LPA`
- **Madrid** `MAD`
- **Málaga** `AGP`
- **Palma de Mallorca** `PMI`
- **Tenerife** `TFS`

### Sweden (2)
- **Gothenburg** `GOT`
- **Stockholm** `ARN`

### Switzerland (2)
- **Geneva** `GVA`
- **Zurich** `ZRH`

### Thailand (1)
- **Bangkok** `BKK`

### Türkiye (2)
- **Antalya** `AYT`
- **Istanbul** `IST`

### United Arab Emirates (1)
- **Dubai** `DXB`

### United Kingdom (6)
- **Bristol** `BRS`
- **East Midlands** `EMA`
- **Edinburgh** `EDI`
- **Liverpool** `LPL`
- **London** `LGW` `LTN` `STN`
- **Manchester** `MAN`

### United States (1)
- **New York** `JFK`

### Uzbekistan (1)
- **Tashkent** `TAS`

## Non-destination tiles

- **Vilnius**, **Kaunas**, **Riga** — origin-city collection tiles (old town at golden hour), 2048×1024, `--duotone` treatment.
- **September sun**, **Christmas markets**, **Winter sun**, **Ski season**, **Last-minute weekends** — moment tiles (10 templates live; generate for the ones with a collection page).

**Totals:** 96 cities × 3 = 288 landscape images; ~29 core × 2 portrait = ~58; + 8 tiles. ≈ **354 generations**.
