// Yip — sample curated deals (fake data for the UI kit demo)
window.YIP_DEALS = [
  {
    id: "vno-lca",
    place: "Larnaca", country: "Cyprus", from: "VNO", to: "LCA",
    grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
    eyebrow: "Last warm week", moment: "September sun",
    headline: "Sun's still out in Cyprus — and the crowds have gone",
    dates: "14–21 Oct", legs: "Direct · 4h", airline: "Wizz Air",
    price: 59, usual: 102, hot: true, origin: "Vilnius",
    why: [
      ["trending-down", "42% under the usual fare for these dates"],
      ["plane", "Direct flight — no layovers"],
      ["sun", "Still 27°C, sea's warm, beaches quiet"],
    ],
    caveats: [
      ["luggage", "Hand luggage only (add a bag for ~€25)"],
      ["clock", "Return lands at 23:40"],
    ],
    note: "A genuinely good shoulder-season week. We'd book the outbound Saturday — the Tuesday return is the cheapest leg.",
  },
  {
    id: "kun-mla",
    place: "Valletta", country: "Malta", from: "KUN", to: "MLA",
    grad: "linear-gradient(150deg,#54B7A2,#0F7C68 70%,#093D36)",
    eyebrow: "September sun", moment: "City break",
    headline: "Malta long weekend — honey-stone streets, warm sea",
    dates: "19–22 Sep", legs: "1 stop · 6h", airline: "Ryanair",
    price: 74, usual: 138, hot: false, origin: "Kaunas",
    why: [
      ["trending-down", "46% under usual"],
      ["sun", "28°C and swimmable into October"],
      ["map-pin", "20 min from airport to the old town"],
    ],
    caveats: [
      ["repeat", "1 stop in Bergamo, 1h10 layover"],
      ["luggage", "Hand luggage only"],
    ],
    note: "Great value for a 3-night city break with beach time tacked on.",
  },
  {
    id: "rix-ath",
    place: "Athens", country: "Greece", from: "RIX", to: "ATH",
    grad: "linear-gradient(150deg,#F3B84E,#C56A07 70%,#5C320F)",
    eyebrow: "Plan ahead", moment: "Sun + culture",
    headline: "Athens in October — €68 return from Riga",
    dates: "9–16 Oct", legs: "Direct · 3h", airline: "airBaltic",
    price: 68, usual: 119, hot: false, origin: "Riga",
    why: [
      ["trending-down", "43% under usual"],
      ["plane", "Direct with airBaltic"],
      ["sun", "Mild 24°C — perfect for the ruins"],
    ],
    caveats: [
      ["clock", "Outbound departs 06:05"],
    ],
    note: "Pair the Acropolis with a couple of island day-trips while the sea's still warm.",
  },
  {
    id: "vno-vie",
    place: "Vienna", country: "Austria", from: "VNO", to: "VIE",
    grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
    eyebrow: "Christmas markets", moment: "Winter weekend",
    headline: "Vienna Christmas-market weekend for €45",
    dates: "5–8 Dec", legs: "Direct · 1h45", airline: "Ryanair",
    price: 45, usual: 88, hot: true, origin: "Vilnius",
    why: [
      ["trending-down", "49% under usual"],
      ["plane", "Direct, short hop"],
      ["snowflake", "Peak market season, glühwein everywhere"],
    ],
    caveats: [
      ["luggage", "Hand luggage only"],
      ["bus", "City bus from airport ~25 min"],
    ],
    note: "The best-value market weekend we've seen this year. Hotels still reasonable if you book now.",
  },
  {
    id: "kun-agp",
    place: "Málaga", country: "Spain", from: "KUN", to: "AGP",
    grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
    eyebrow: "Last-minute", moment: "Long weekend",
    headline: "Costa del Sol escape — leaving this Friday",
    dates: "This Fri–Mon", legs: "Direct · 4h30", airline: "Ryanair",
    price: 52, usual: 110, hot: true, origin: "Kaunas",
    why: [
      ["trending-down", "53% under usual"],
      ["plane", "Direct from Kaunas"],
      ["sun", "25°C, last proper beach days"],
    ],
    caveats: [
      ["clock", "Return lands 00:35 Tuesday"],
      ["luggage", "Hand luggage only"],
    ],
    note: "Pure last-minute sun. Move fast — the Friday outbound is almost gone.",
  },
  {
    id: "rix-fao",
    place: "Faro", country: "Portugal", from: "RIX", to: "FAO",
    grad: "linear-gradient(150deg,#8FD2C2,#239A83 70%,#094E43)",
    eyebrow: "Plan ahead", moment: "Summer holiday",
    headline: "Algarve in June — book now, pay holiday-you later",
    dates: "7–14 Jun", legs: "1 stop · 7h", airline: "Lufthansa",
    price: 119, usual: 198, hot: false, origin: "Riga",
    why: [
      ["trending-down", "40% under usual summer fare"],
      ["sun", "Reliable 26°C and the Atlantic coast"],
    ],
    caveats: [
      ["repeat", "1 stop in Frankfurt"],
    ],
    note: "Summer fares only go up. This is a strong lock-it-in-early price for peak June.",
  },
];

window.YIP_AIRPORTS = ["All airports", "Vilnius", "Kaunas", "Riga"];
window.YIP_MOMENTS = ["All", "Sun", "City break", "Christmas", "Last-minute"];
