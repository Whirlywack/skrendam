/**
 * The Lithuanian copy deck — single source for every UI string
 * (V2 spec §3, founder-approved 2026-08-28).
 *
 * Voice: tu, lowercase, spoken short verbs (randam, tikrinam, siunčiam).
 * Product noun: „radinys", never „pasiūlymas". Banned: akcija, superkaina,
 * nepraleisk progos!, anglo-slang, exclamation stacking.
 */
export const S = {
  // Hero
  heroH1: 'Randam perliukus.',
  heroSub:
    'Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos, atrinkti žmogaus — 3–5 per savaitę. ' +
    'Prie kiekvieno: kodėl verta ir koks kabliukas. Bilietą perki tiesiogiai.',
  humanStamp: 'patikrino žmogus',

  // Badges & chips
  badgeRare: 'Retas radinys',
  badgeGreat: 'Geras radinys',
  chipGoingFast: 'Tirpsta',

  // Sections
  trophyHeader: 'Buvo. Nebėra.',
  trophyCaption: 'Kas gavo laišką — spėjo.',
  trophyFootnote: 'Retas radinys gyvena porą dienų. Laišką gauni anksčiau, nei jis dingsta.',
  liveHeader: 'Dar spėji',
  thisWeek: 'Šios savaitės radiniai',

  // CTAs
  ctaSeeDeal: 'Žiūrėti skrydį',
  ctaSeeDealHero: 'Skrendam?', // hero card only, max once per page (spec §8.3)
  ctaHeaderPill: 'Noriu radinių',
  ctaBandFull: 'Gauk radinius el. paštu',
  ctaSubmit: 'Noriu radinių',

  // Ink band / capture
  bandH2: 'Kitas perliukas dings per porą dienų.',
  bandBody:
    'Prenumeratoriai gauna kiekvieną radinį tą rytą, kai jį patvirtinam. ' +
    'Kol jis čia — pigiausių vietų dažnai nebelieka.',
  finePrint: 'Nemokama · 3–5 radiniai per savaitę · be spamo · atsisakai kada nori',

  // Signup states
  successTitle: 'Liko vienas žingsnis — patvirtink el. paštą.',
  successSub: 'Išsiuntėm patvirtinimo nuorodą. Paspausk ją — ir kitas radinys tavo.',
  subscribedTitle: 'Viskas — lauk radinių.',
  subscribedSub: 'Pirmieji radiniai tavo pašte šią savaitę.',
  earlyCheckbox: 'Noriu ir skubių žinučių — nemokamai',
  earlyCheckboxSub: 'Rečiausi radiniai iškart, kai tik juos randam — dar prieš savaitinį laišką.',
  emailPlaceholder: 'tavo@pastas.lt',
  emailInvalid: 'Įvesk veikiantį el. pašto adresą.',
  genericError: 'Kažkas nepavyko — pabandyk dar kartą.',

  // Nav & footer
  navHow: 'Kaip tai veikia',
  navDeals: 'Radiniai',
  navCollections: 'Kryptys',
  navAria: 'Svetainės navigacija',
  footerMade: 'Sukurta Vilniuje',
  fromVilnius: 'Iš Vilniaus',
  fromKaunas: 'Iš Kauno',
  fromRiga: 'Iš Rygos',
  fromPill: 'Iš VNO · KUN · RIX',
  footerLead:
    'Atrinkti pigūs skrydžiai iš Vilniaus, Kauno ir Rygos. Randam perliukus, kad tau nereikėtų.',
  footerXmas: 'Kalėdų mugės',
  footerEarly: 'Skubios žinutės',
  footerContact: 'Rašyk mums',
  footerFollow: 'Sek mus',
  footerLegal: '© 2026 Yip. Bilietą perki pas aviakompaniją ar agentūrą — kainos keičiasi greitai.',

  // Signup card / capture
  freeBadge: 'Nemokama',
  capTitle: 'Gauk kitą retą radinį el. paštu',
  capSub: 'Geriausi radiniai viename ramiame savaitiniame laiške.',
  submitting: 'Siunčiam…',
  emailAria: 'El. pašto adresas',
  trustNoSpam: 'Be spamo',
  trustUnsub: 'Atsisakai kada nori',
  trustHuman: 'Tikrinta žmogaus',

  // Deal ticket
  chipCheaper: 'pigiau',
  retRoundTrip: 'į abi puses',

  // Collections
  collEyebrow: 'Rinkis kryptį',
  collHeader: 'Kur nori skristi?',

  // Site metadata
  metaTitle: 'Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos — atrinkti žmogaus | Yip',
  metaDescription:
    'Randam pigius skrydžius iš Vilniaus, Kauno ir Rygos, patikrinam ir pasakom, ' +
    'kodėl verta ir koks kabliukas. Bilietą perki tiesiogiai.',
  ogTitle: 'Yip — pigūs skrydžiai iš Vilniaus, Kauno ir Rygos',
  ogDescription:
    'Žmogaus patikrinti radiniai iš Vilniaus, Kauno ir Rygos. Prie kiekvieno — ' +
    'kodėl verta ir koks kabliukas.',

  // V2 poster & bead surfaces
  mastheadKicker: 'Atrinkti skrydžiai — Vilnius · Kaunas · Ryga',
  issueLabel: 'Laiškas Nr. 1 — vėlyva vasara', // issue numbering ties to the email
  dealNoWord: 'Radinys', // poster kicker: "Radinys Nr. 01"
  captureLine: 'Kasdien peržiūrim visus maršrutus iš VNO, KUN ir RIX. Skelbiam tik tai, kas atlaiko patikrą.',
  trustDirect: 'Bilietą perki tiesiogiai iš aviakompanijos — mes tavo pinigų neliečiam.',
  youSaveVs: 'nuo įprastos kainos', // "SUTAUPAI 72 € NUO ĮPRASTOS KAINOS"
  savedWord: 'sutaupė', // trophy meta: "RIX → OSL · SUTAUPĖ 90 €"
  saveWord: 'sutaupai',
  updatedMorning: 'atnaujinta šįryt',
  thisWeekOf: 'šią savaitę', // poster kicker: "Nr. 01 iš 04 šią savaitę"

  // Data layer (mappers / deal page / collections / metadata)
  foundByHand: 'Atrinkta žmogaus', // eyebrow fallback when the curator wrote no public label
  navHome: 'Pradžia',
  navAllDeals: 'Visi radiniai',
  checkedByHand: 'Rasta ir patikrinta žmogaus.', // metadata / JSON-LD sentence tail
  retOneWay: 'į vieną pusę',
} as const;

// Curator identity is configurable, never hardcoded — different people may
// front different issues (spec §8.1). Set CURATOR_NAME in the environment.
export function curator(): { name: string; sig: string } {
  const name = process.env.CURATOR_NAME?.trim() || '';
  return {
    name,
    sig: name ? `${name} — Yip kuratorius, Vilnius` : 'Yip kuratorius, Vilnius',
  };
}
