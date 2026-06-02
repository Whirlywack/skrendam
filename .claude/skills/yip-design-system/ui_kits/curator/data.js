// Yip curator tool — candidate deals surfaced by the scanner (fake data)
window.YIP_CANDIDATES = [
  {
    id: "c1", score: 92, status: "suggested",
    place: "Larnaca", country: "Cyprus", from: "VNO", to: "LCA", origin: "Vilnius",
    price: 59, usual: 102, drop: 42, dates: "14–21 Oct", legs: "Direct · 4h", airline: "Wizz Air",
    template: "Last warm week · sun",
    signals: ["42% below 90-day median", "Direct route", "Shoulder season (27°C)", "Seat availability: healthy"],
    flags: ["Hand luggage only", "Return lands 23:40"],
    grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
    copy: {
      headline: [
        "€59 return to Cyprus — last warm week of the year",
        "Sun's still out in Cyprus, and the crowds have gone — €59",
        "Sneak a Cyprus week in before winter: €59 return from Vilnius",
      ],
      hook: "POV: it's 6°C in Vilnius but you just found €59 returns to 27°C Cyprus 🌴 link in bio before it's gone",
      news: "We dug up a €59 return to Larnaca for the last warm week of October — direct from Vilnius, 42% under the usual fare. Hand luggage only and the return lands late, but the sea's still warm and the beaches are empty.",
    },
  },
  {
    id: "c2", score: 88, status: "suggested",
    place: "Vienna", country: "Austria", from: "VNO", to: "VIE", origin: "Vilnius",
    price: 45, usual: 88, drop: 49, dates: "5–8 Dec", legs: "Direct · 1h45", airline: "Ryanair",
    template: "Christmas markets · weekend",
    signals: ["49% below median", "Peak market season", "Direct, short hop", "Fare dropped 3× this week"],
    flags: ["Hand luggage only", "Bus to airport"],
    grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
    copy: {
      headline: [
        "Vienna Christmas-market weekend for €45",
        "Glühwein o'clock: €45 return to Vienna in December",
        "€45 to Vienna for the Christmas markets — direct from Vilnius",
      ],
      hook: "€45 return to Vienna for the Christmas markets?? christmas-girlie behaviour, sending this to my group chat rn 🎄",
      news: "A €45 return to Vienna lands you right in peak Christmas-market season — direct from Vilnius, 49% under usual. Hand luggage only and you'll bus in from the airport, but glühwein season makes up for it.",
    },
  },
  {
    id: "c3", score: 76, status: "suggested",
    place: "Málaga", country: "Spain", from: "KUN", to: "AGP", origin: "Kaunas",
    price: 52, usual: 110, drop: 53, dates: "This Fri–Mon", legs: "Direct · 4h30", airline: "Ryanair",
    template: "Last-minute · long weekend",
    signals: ["53% below median", "Direct from Kaunas", "Last-minute window", "Limited seats left"],
    flags: ["Return lands 00:35", "Hand luggage only"],
    grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
    copy: {
      headline: [
        "Costa del Sol escape — leaving this Friday, €52",
        "Last-minute Málaga: €52 return from Kaunas this weekend",
        "Drop everything: €52 to Málaga, wheels up Friday",
      ],
      hook: "leaving for málaga this friday for €52 and telling my boss monday 😎☀️",
      news: "Pure last-minute sun: €52 return to Málaga from Kaunas, leaving this Friday. 53% under usual. The return lands at 00:35 and it's hand luggage only — but it's 25°C and the beaches are still open.",
    },
  },
  {
    id: "c4", score: 64, status: "review",
    place: "Athens", country: "Greece", from: "RIX", to: "ATH", origin: "Riga",
    price: 68, usual: 119, drop: 43, dates: "9–16 Oct", legs: "Direct · 3h", airline: "airBaltic",
    template: "Sun + culture · plan ahead",
    signals: ["43% below median", "Direct with airBaltic", "Mild 24°C"],
    flags: ["Outbound departs 06:05"],
    grad: "linear-gradient(150deg,#F3B84E,#C56A07 70%,#5C320F)",
    copy: {
      headline: [
        "Athens in October — €68 return from Riga",
        "Acropolis weather, autumn prices: €68 to Athens",
        "€68 return to Athens, direct from Riga",
      ],
      hook: "€68 to athens in october, sun + ruins + no crowds, the dream 🏛️",
      news: "A €68 return to Athens from Riga, direct with airBaltic — 43% under usual. Early 06:05 outbound, but you get mild 24°C and the ruins without the summer crowds.",
    },
  },
  {
    id: "c5", score: 41, status: "rejected",
    place: "Faro", country: "Portugal", from: "RIX", to: "FAO", origin: "Riga",
    price: 119, usual: 198, drop: 40, dates: "7–14 Jun", legs: "1 stop · 7h", airline: "Lufthansa",
    template: "Summer holiday · plan ahead",
    signals: ["40% below summer median", "Reliable 26°C"],
    flags: ["1 stop in Frankfurt", "Long total travel time"],
    grad: "linear-gradient(150deg,#8FD2C2,#239A83 70%,#094E43)",
    copy: {
      headline: ["Algarve in June — €119 return, book now", "Lock in summer: €119 to Faro from Riga"],
      hook: "booking my june algarve trip for €119 in march like a responsible adult 🧴",
      news: "Summer fares only climb: €119 return to Faro for peak June, 40% under usual. One stop in Frankfurt and a longer travel day, but a strong early lock-in for the Algarve.",
    },
  },
];

window.YIP_SCAN = { fares: "2,143", airports: 4, ago: "4 min ago", newToday: 3 };
