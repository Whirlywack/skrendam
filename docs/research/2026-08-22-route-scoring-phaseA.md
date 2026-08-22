# Route scoring — Phase A (data-driven route selection)

_Date: 2026-08-22. Scores PR #8's 146 routes + the August delta (159 total) on
four axes: persona coverage (which templates the route feeds), demand (LT Google Ads
search volume for the destination city, collected today), competition (verified carrier
count where known), and operations (seasonality; Wave-0 dispersion for the 14 live
routes ★). Method + caveats at the bottom._

## Proposed CORE (30) — scan daily

| Route | City | Zone | LT vol/mo | Carriers | Disp. | Season | Feeds | Score |
|---|---|---|---|---|---|---|---|---|
| VNO→BCN | Barcelona ★ | MEDITERRA | 8,000 | 2 | 25% | yr | family-sun, last-warm, plan-ahead, september-sun | 93 |
| VNO→AGP | Malaga ★ | MEDITERRA | 14,800 | 2 | 17% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 91 |
| VNO→STN | London ★ | CITY_BREA | 2,900 | ? | 44% | yr | last-minute, vfr, xmas-markets | 80 |
| VNO→CPH | Copenhagen ★ | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 66 |
| VNO→VIE | Vienna ★ | CITY_BREA | 2,400 | 2 | 4% | yr | last-minute, xmas-markets | 66 |
| VNO→LCA | Larnaca ★ | MEDITERRA | 1,300 | ? | 22% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 80 |
| KUN→AGP | Malaga ★ | MEDITERRA | 14,800 | ? | 30% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 91 |
| KUN→BGY | Milan ★ | CITY_BREA | 5,400 | ? | — | yr | last-minute, xmas-markets | 68 |
| KUN→STN | London ★ | CITY_BREA | 2,900 | ? | 36% | yr | last-minute, vfr, xmas-markets | 80 |
| KUN→CIA | Rome ★ | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 65 |
| RIX→TFS | Tenerife ★ | CANARIES | 6,600 | ? | 11% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 79 |
| RIX→AYT | Antalya ★ | MEDITERRA | 880 | ? | 11% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 |
| RIX→BCN | Barcelona ★ | MEDITERRA | 8,000 | ? | 17% | yr | family-sun, last-warm, plan-ahead, september-sun | 83 |
| RIX→PRG | Prague ★ | CITY_BREA | 1,900 | ? | 3% | yr | last-minute, xmas-markets | 59 |
| KUN→DUB | Dublin | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| VNO→OSL | Oslo | SCANDINAV | 1,900 | 2 | — | yr | last-minute, vfr, xmas-markets | 67 |
| RIX→LGW | London | WESTERN_E | 2,900 | ? | — | yr | last-minute, vfr, xmas-markets | 63 |
| RIX→TAS | Tashkent | LONG_HAUL | 2,900 | ? | — | yr | long-haul | 50 |
| VNO→DXB | Dubai | MIDDLE_EA | 9,900 | 2 | — | yr | winter-sun | 60 |
| VNO→TFS | Tenerife | CANARIES | 6,600 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 71 |
| VNO→MLA | Malta | MEDITERRA | 18,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 |
| RIX→FNC | Madeira | MEDITERRA | 12,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 73 |
| VNO→LTN | London | CITY_BREA | 2,900 | 2 | — | yr | last-minute, vfr, xmas-markets | 69 |
| VNO→DUB | Dublin | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| VNO→BER | Berlin | CITY_BREA | 2,400 | 3 | — | yr | last-minute, xmas-markets | 64 |
| VNO→GVA | Geneva | ALPS | 720 | ? | — | Jan–Mar | ski | 44 |
| VNO→TRN | Turin | ALPS | 1,900 | 2 | — | yr | ski | 55 |
| RIX→MLA | Malta | MEDITERRA | 18,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 |
| KUN→ALC | Alicante | MEDITERRA | 4,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 70 |
| RIX→ALC | Alicante | MEDITERRA | 4,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 70 |

## Full ranking (159 routes) — everything below core rotates in cohorts

| Route | City | Zone | LT vol/mo | Carriers | Disp. | Season | Feeds | Score |
|---|---|---|---|---|---|---|---|---|
| VNO→BCN | Barcelona ★ | MEDITERRA | 8,000 | 2 | 25% | yr | family-sun, last-warm, plan-ahead, september-sun | 93 **CORE** |
| VNO→AGP | Malaga ★ | MEDITERRA | 14,800 | 2 | 17% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 91 **CORE** |
| KUN→AGP | Malaga ★ | MEDITERRA | 14,800 | ? | 30% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 91 **CORE** |
| RIX→BCN | Barcelona ★ | MEDITERRA | 8,000 | ? | 17% | yr | family-sun, last-warm, plan-ahead, september-sun | 83 **CORE** |
| VNO→LCA | Larnaca ★ | MEDITERRA | 1,300 | ? | 22% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 80 **CORE** |
| VNO→STN | London ★ | CITY_BREA | 2,900 | ? | 44% | yr | last-minute, vfr, xmas-markets | 80 **CORE** |
| KUN→STN | London ★ | CITY_BREA | 2,900 | ? | 36% | yr | last-minute, vfr, xmas-markets | 80 **CORE** |
| RIX→TFS | Tenerife ★ | CANARIES | 6,600 | ? | 11% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 79 **CORE** |
| VNO→MLA | Malta | MEDITERRA | 18,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 **CORE** |
| RIX→MLA | Malta | MEDITERRA | 18,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 **CORE** |
| RIX→AYT | Antalya ★ | MEDITERRA | 880 | ? | 11% | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 74 **CORE** |
| RIX→AGP | Malaga | MEDITERRA | 14,800 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 73 |
| RIX→FNC | Madeira | MEDITERRA | 12,100 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 73 **CORE** |
| VNO→TFS | Tenerife | CANARIES | 6,600 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 71 **CORE** |
| KUN→BOJ | Burgas | MEDITERRA | 15,000 | ? | — | summer | family-sun, last-warm, plan-ahead, september-sun | 71 |
| KUN→ALC | Alicante | MEDITERRA | 4,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 70 **CORE** |
| RIX→ALC | Alicante | MEDITERRA | 4,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 70 **CORE** |
| VNO→LTN | London | CITY_BREA | 2,900 | 2 | — | yr | last-minute, vfr, xmas-markets | 69 **CORE** |
| VNO→CTA | Catania | MEDITERRA | 2,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 68 |
| VNO→NCE | Nice | MEDITERRA | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 68 |
| VNO→LPA | Gran Canaria | CANARIES | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 68 |
| KUN→MAD | Madrid | MEDITERRA | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 68 |
| KUN→BRI | Bari | MEDITERRA | 2,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 68 |
| KUN→BGY | Milan ★ | CITY_BREA | 5,400 | ? | — | yr | last-minute, xmas-markets | 68 **CORE** |
| RIX→MAD | Madrid | MEDITERRA | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 68 |
| RIX→CTA | Catania | MEDITERRA | 2,400 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 68 |
| RIX→SSH | Sharm el-Sheikh | MEDITERRA | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 68 |
| RIX→LPA | Gran Canaria | CANARIES | 1,900 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 68 |
| VNO→CFU | Corfu | MEDITERRA | 2,900 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 67 |
| VNO→PMI | Palma | MEDITERRA | 1,300 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 67 |
| VNO→TIA | Tirana | MEDITERRA | 2,900 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 67 |
| VNO→OSL | Oslo | SCANDINAV | 1,900 | 2 | — | yr | last-minute, vfr, xmas-markets | 67 **CORE** |
| KUN→PMI | Palma | MEDITERRA | 1,300 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 67 |
| KUN→NAP | Naples | MEDITERRA | 1,600 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 67 |
| KUN→PFO | Paphos | MEDITERRA | 1,600 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 67 |
| RIX→LCA | Larnaca | MEDITERRA | 1,300 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 67 |
| RIX→CFU | Corfu | MEDITERRA | 2,900 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 67 |
| RIX→PMI | Palma | MEDITERRA | 1,300 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 67 |
| RIX→TIA | Tirana | MEDITERRA | 2,900 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 67 |
| VNO→TGD | Podgorica | MEDITERRA | 2,900 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 67 |
| VNO→CPH | Copenhagen ★ | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 66 **CORE** |
| VNO→VIE | Vienna ★ | CITY_BREA | 2,400 | 2 | 4% | yr | last-minute, xmas-markets | 66 **CORE** |
| KUN→PSA | Pisa | MEDITERRA | 1,000 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 66 |
| RIX→FAO | Faro | MEDITERRA | 1,000 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 66 |
| VNO→EIN | Eindhoven | WESTERN_E | 1,900 | 2 | — | Aug–Jan | last-minute, vfr, xmas-markets | 65 |
| KUN→RHO | Rhodes | MEDITERRA | 1,600 | ? | — | summer | family-sun, last-warm, plan-ahead, september-sun | 65 |
| KUN→CIA | Rome ★ | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 65 **CORE** |
| RIX→RHO | Rhodes | MEDITERRA | 1,600 | ? | — | summer | family-sun, last-warm, plan-ahead, september-sun | 65 |
| RIX→SPU | Split | MEDITERRA | 1,900 | ? | — | summer | family-sun, last-warm, plan-ahead, september-sun | 65 |
| RIX→HRG | Hurghada | MEDITERRA | 720 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 65 |
| RIX→SKG | Thessaloniki | MEDITERRA | 720 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun | 65 |
| VNO→ATH | Athens | MEDITERRA | 1,300 | ? | — | seasonal | family-sun, last-warm, plan-ahead, september-sun | 64 |
| VNO→LIS | Lisbon | MEDITERRA | 1,300 | ? | — | Aug–Jan | family-sun, last-warm, plan-ahead, september-sun | 64 |
| VNO→BER | Berlin | CITY_BREA | 2,400 | 3 | — | yr | last-minute, xmas-markets | 64 **CORE** |
| VNO→MXP | Milan | CITY_BREA | 5,400 | 2 | — | yr | last-minute, xmas-markets | 64 |
| RIX→ATH | Athens | MEDITERRA | 1,300 | ? | — | seasonal | family-sun, last-warm, plan-ahead, september-sun | 64 |
| RIX→LIS | Lisbon | MEDITERRA | 1,300 | ? | — | Aug–Jan | family-sun, last-warm, plan-ahead, september-sun | 64 |
| VNO→HER | Heraklion | MEDITERRA | 720 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 63 |
| VNO→BVA | Paris | WESTERN_E | 2,900 | ? | — | yr | last-minute, vfr, xmas-markets | 63 |
| KUN→LTN | London | CITY_BREA | 2,900 | ? | — | yr | last-minute, vfr, xmas-markets | 63 |
| RIX→HER | Heraklion | MEDITERRA | 720 | ? | — | Aug–Oct | family-sun, last-warm, plan-ahead, september-sun | 63 |
| RIX→DBV | Dubrovnik | MEDITERRA | 880 | ? | — | summer | family-sun, last-warm, plan-ahead, september-sun | 63 |
| RIX→RAK | Marrakesh | MEDITERRA | 320 | ? | — | yr | family-sun, last-warm, plan-ahead, september-sun, winter-sun | 63 |
| RIX→LGW | London | WESTERN_E | 2,900 | ? | — | yr | last-minute, vfr, xmas-markets | 63 **CORE** |
| RIX→STN | London | WESTERN_E | 2,900 | ? | — | yr | last-minute, vfr, xmas-markets | 63 |
| VNO→PRG | Prague | CITY_BREA | 1,900 | 2 | — | yr | last-minute, xmas-markets | 61 |
| VNO→MUC | Munich | CITY_BREA | 1,600 | ? | — | yr | last-minute, ski, xmas-markets | 61 |
| KUN→CGN | Cologne | CITY_BREA | 1,900 | ? | — | yr | last-minute, vfr, xmas-markets | 61 |
| KUN→EDI | Edinburgh | WESTERN_E | 1,900 | ? | — | yr | last-minute, vfr, xmas-markets | 61 |
| RIX→OSL | Oslo | SCANDINAV | 1,900 | ? | — | yr | last-minute, vfr, xmas-markets | 61 |
| RIX→MUC | Munich | CITY_BREA | 1,600 | ? | — | yr | last-minute, ski, xmas-markets | 61 |
| RIX→EDI | Edinburgh | WESTERN_E | 1,900 | ? | — | yr | last-minute, vfr, xmas-markets | 61 |
| VNO→ZRH | Zurich | CITY_BREA | 1,300 | ? | — | yr | last-minute, ski, xmas-markets | 60 |
| VNO→DUB | Dublin | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 **CORE** |
| VNO→DTM | Dortmund | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| VNO→DXB | Dubai | MIDDLE_EA | 9,900 | 2 | — | yr | winter-sun | 60 **CORE** |
| KUN→DUB | Dublin | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 **CORE** |
| KUN→LPL | Liverpool | WESTERN_E | 1,000 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| KUN→CRL | Brussels | WESTERN_E | 1,000 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| RIX→ZRH | Zurich | CITY_BREA | 1,300 | ? | — | yr | last-minute, ski, xmas-markets | 60 |
| RIX→DUB | Dublin | WESTERN_E | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| RIX→CRL | Brussels | WESTERN_E | 1,000 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| VNO→HAM | Hamburg | CITY_BREA | 1,300 | ? | — | yr | last-minute, vfr, xmas-markets | 60 |
| VNO→BGO | Bergen | SCANDINAV | 1,600 | ? | — | Aug–Sep | last-minute, vfr, xmas-markets | 59 |
| VNO→HHN | Frankfurt | WESTERN_E | 1,900 | ? | — | Aug–Oct | last-minute, vfr, xmas-markets | 59 |
| KUN→BRS | Bristol | WESTERN_E | 720 | ? | — | yr | last-minute, vfr, xmas-markets | 59 |
| RIX→BGO | Bergen | SCANDINAV | 1,600 | ? | — | Aug–Sep | last-minute, vfr, xmas-markets | 59 |
| RIX→PRG | Prague ★ | CITY_BREA | 1,900 | ? | 3% | yr | last-minute, xmas-markets | 59 **CORE** |
| RIX→MAN | Manchester | WESTERN_E | 880 | ? | — | yr | last-minute, vfr, xmas-markets | 59 |
| VNO→BGY | Milan | CITY_BREA | 5,400 | ? | — | yr | last-minute, xmas-markets | 58 |
| RIX→MXP | Milan | CITY_BREA | 5,400 | ? | — | yr | last-minute, xmas-markets | 58 |
| RIX→BGY | Milan | CITY_BREA | 5,400 | ? | — | yr | last-minute, xmas-markets | 58 |
| RIX→EMA | Nottingham | WESTERN_E | 500 | ? | — | yr | last-minute, vfr, xmas-markets | 58 |
| VNO→BUD | Budapest | CITY_BREA | 3,600 | ? | — | yr | last-minute, xmas-markets | 57 |
| VNO→WAW | Warsaw | CITY_BREA | 3,600 | ? | — | yr | last-minute, xmas-markets | 57 |
| VNO→GDN | Gdansk | WESTERN_E | 4,400 | ? | — | yr | last-minute, xmas-markets | 57 |
| VNO→TLV | Tel Aviv | MIDDLE_EA | 1,900 | 3 | — | yr | winter-sun | 57 |
| KUN→SNN | Shannon | WESTERN_E | 480 | ? | — | yr | last-minute, vfr, xmas-markets | 57 |
| RIX→BUD | Budapest | CITY_BREA | 3,600 | ? | — | yr | last-minute, xmas-markets | 57 |
| RIX→WAW | Warsaw | CITY_BREA | 3,600 | ? | — | yr | last-minute, xmas-markets | 57 |
| VNO→DUS | Dusseldorf | WESTERN_E | 1,000 | ? | — | Aug–Jan | last-minute, vfr, xmas-markets | 57 |
| VNO→NRN | Dusseldorf | WESTERN_E | 1,000 | ? | — | Feb–Mar | last-minute, vfr, xmas-markets | 57 |
| VNO→ARN | Stockholm | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| VNO→KRK | Krakow | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| VNO→AMS | Amsterdam | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| VNO→CDG | Paris | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| KUN→CPH | Copenhagen | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| KUN→ARN | Stockholm | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→CPH | Copenhagen | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→ARN | Stockholm | SCANDINAV | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→VIE | Vienna | CITY_BREA | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→BER | Berlin | CITY_BREA | 2,400 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→AMS | Amsterdam | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→CDG | Paris | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| RIX→KRK | Krakow | CITY_BREA | 2,900 | ? | — | yr | last-minute, xmas-markets | 56 |
| VNO→HEL | Helsinki | SCANDINAV | 1,900 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→FCO | Rome | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→CIA | Rome | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→IST | Istanbul | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→FRA | Frankfurt | CITY_BREA | 1,900 | ? | — | yr | last-minute, xmas-markets | 55 |
| RIX→HEL | Helsinki | SCANDINAV | 1,900 | ? | — | yr | last-minute, xmas-markets | 55 |
| RIX→FCO | Rome | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| RIX→FRA | Frankfurt | CITY_BREA | 1,900 | ? | — | yr | last-minute, xmas-markets | 55 |
| RIX→IST | Istanbul | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| RIX→FMM | Memmingen | WESTERN_E | 170 | ? | — | yr | last-minute, vfr, xmas-markets | 55 |
| RIX→TSF | Venice | WESTERN_E | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→TRN | Turin | ALPS | 1,900 | 2 | — | yr | ski | 55 **CORE** |
| VNO→TSF | Venice | CITY_BREA | 1,600 | ? | — | yr | last-minute, xmas-markets | 55 |
| VNO→KEF | Reykjavik | SCANDINAV | 1,300 | ? | — | yr | last-minute, xmas-markets | 54 |
| RIX→KEF | Reykjavik | SCANDINAV | 1,300 | ? | — | yr | last-minute, xmas-markets | 54 |
| RIX→DXB | Dubai | MIDDLE_EA | 9,900 | ? | — | yr | winter-sun | 54 |
| VNO→BRU | Brussels | CITY_BREA | 1,000 | ? | — | yr | last-minute, xmas-markets | 53 |
| KUN→GOT | Gothenburg | SCANDINAV | 880 | ? | — | yr | last-minute, xmas-markets | 53 |
| RIX→BRU | Brussels | CITY_BREA | 1,000 | ? | — | yr | last-minute, xmas-markets | 53 |
| RIX→OTP | Bucharest | CITY_BREA | 1,000 | ? | — | yr | last-minute, xmas-markets | 53 |
| RIX→LJU | Ljubljana | CITY_BREA | 880 | ? | — | yr | last-minute, xmas-markets | 53 |
| RIX→OUL | Oulu | SCANDINAV | 590 | ? | — | yr | last-minute, xmas-markets | 52 |
| RIX→TMP | Tampere | SCANDINAV | 600 | ? | — | yr | last-minute, xmas-markets | 52 |
| RIX→BEG | Belgrade | CITY_BREA | 590 | ? | — | yr | last-minute, xmas-markets | 52 |
| RIX→SOF | Sofia | CITY_BREA | 720 | ? | — | yr | last-minute, xmas-markets | 52 |
| VNO→BLL | Billund | SCANDINAV | 1,000 | ? | — | Aug–Oct | last-minute, xmas-markets | 51 |
| VNO→RMO | Chisinau | WESTERN_E | 390 | ? | — | yr | last-minute, xmas-markets | 51 |
| KUN→RIX | Riga | WESTERN_E | 500 | ? | — | yr | last-minute, xmas-markets | 51 |
| RIX→BLL | Billund | SCANDINAV | 1,000 | ? | — | Aug–Oct | last-minute, xmas-markets | 51 |
| RIX→RMO | Chisinau | WESTERN_E | 390 | ? | — | yr | last-minute, xmas-markets | 51 |
| VNO→BKK | Bangkok | LONG_HAUL | 4,000 | ? | — | yr | long-haul | 51 |
| VNO→JFK | New York | LONG_HAUL | 3,500 | ? | — | yr | long-haul | 51 |
| VNO→KUT | Kutaisi | CAUCASUS | 2,400 | ? | — | yr | last-minute | 50 |
| RIX→PLQ | Palanga | WESTERN_E | 300 | ? | — | yr | last-minute, xmas-markets | 50 |
| RIX→TAS | Tashkent | LONG_HAUL | 2,900 | ? | — | yr | long-haul | 50 **CORE** |
| VNO→NUE | Nuremberg | CITY_BREA | 700 | ? | — | Aug–Oct | last-minute, xmas-markets | 50 |
| VNO→NRT | Tokyo | LONG_HAUL | 3,000 | ? | — | yr | long-haul | 50 |
| RIX→TLV | Tel Aviv | MIDDLE_EA | 1,900 | ? | — | yr | winter-sun | 49 |
| VNO→TKU | Turku | SCANDINAV | 400 | ? | — | Aug–Sep | last-minute, xmas-markets | 49 |
| RIX→BUS | Batumi | CAUCASUS | 1,300 | ? | — | yr | last-minute | 48 |
| RIX→TBS | Tbilisi | CAUCASUS | 1,000 | ? | — | yr | last-minute | 47 |
| RIX→EVN | Yerevan | CAUCASUS | 320 | ? | — | yr | last-minute | 44 |
| VNO→GVA | Geneva | ALPS | 720 | ? | — | Jan–Mar | ski | 44 **CORE** |
| VNO→GNB | Grenoble | ALPS | 400 | ? | — | winter | ski | 42 |

## Method

- **Score** = 25% persona coverage + 28% demand + 15% competition + 7% ops
  + 10% existing-history bonus (the 14 live routes ★ carry price history — capital
  we should not discard) + 15% dispersion (Wave-0 MAD/median where measured;
  unmeasured routes get a neutral 0.5 — probation measures them in week one).
- **Core-30 constraints**: top-by-score, with guaranteed slots so every template
  family is represented (ski ≥2 in winter, VFR ≥6, winter-sun ≥8, long-haul ≥2).
- Cohort rotation (PR #8's mechanism) covers everything below core; each new
  route's first 2 weeks are probation — dispersion + match rate decide promotion.

## Caveats (honest limits of this sheet)

- **Demand proxy** = LT search volume for the destination city name — includes
  non-travel intent. Football cities were haircut (Barcelona 22.2k→8k, Liverpool
  6.6k→1k); Milan/Dubai use their Lithuanian exonyms (Milanas 5.4k, Dubajus 9.9k);
  Burgas 33k→15k (package-holiday inflation). Latvian volumes for RIX routes NOT
  collected yet — RIX rows use LT volumes as a rough proxy; run a LV pass before
  finalizing RIX core picks.
- **Carrier counts** verified only for VNO (2026-08 research); "?" = unknown, scored
  neutrally. Dispersion exists only for the 14 live routes; probation fills the gap.
- **Dubajus volume** carries a March-2026 news spike (74k that month); trend median
  ~4–8k is still top-decile demand.
- Seasonal routes belong in season-scoped cohorts, not daily scans out of season.
