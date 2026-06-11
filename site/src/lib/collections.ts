export type CollectionFilter =
  | { kind: 'origin'; iata: string }
  | { kind: 'zone'; zone: string }
  | { kind: 'moment'; slug: string };

export interface Collection {
  slug: string;
  label: string;
  scene: string;
  h1: string;
  promise: string;
  filter: CollectionFilter;
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'cheap-flights-from-vilnius',
    label: 'Cheap flights from Vilnius',
    scene: 'ph-city',
    h1: 'Cheap flights from Vilnius',
    promise:
      "The genuinely cheap fares we've hand-checked from Vilnius — why each is good, and the catch.",
    filter: { kind: 'origin', iata: 'VNO' },
  },
  {
    slug: 'cheap-flights-from-kaunas',
    label: 'Cheap flights from Kaunas',
    scene: 'ph-snow',
    h1: 'Cheap flights from Kaunas',
    promise: 'Hand-checked cheap fares from Kaunas.',
    filter: { kind: 'origin', iata: 'KUN' },
  },
  {
    slug: 'cheap-flights-from-riga',
    label: 'Cheap flights from Riga',
    scene: 'ph-city',
    h1: 'Cheap flights from Riga',
    promise: 'Hand-checked cheap fares from Riga.',
    filter: { kind: 'origin', iata: 'RIX' },
  },
  {
    slug: 'september-sun-deals',
    label: 'September sun',
    scene: 'ph-sun',
    h1: 'Cheap September sun flights from the Baltics',
    promise: 'Late-summer warmth, fewer crowds, lower fares — hand-checked.',
    filter: { kind: 'moment', slug: 'sept_shoulder' },
  },
  {
    slug: 'christmas-market-flights',
    label: 'Christmas markets',
    scene: 'ph-market',
    h1: 'Cheap Christmas-market flights from the Baltics',
    promise: "Glühwein-weekend fares to Europe's best markets.",
    filter: { kind: 'moment', slug: 'xmas_markets' },
  },
  {
    slug: 'cyprus-flight-deals-from-lithuania',
    label: 'Cyprus from Lithuania',
    scene: 'ph-coast',
    h1: 'Cheap flights to Cyprus from Lithuania',
    promise: 'Warm-sea Cyprus fares from Vilnius & Kaunas.',
    filter: { kind: 'zone', zone: 'MEDITERRANEAN' },
  },
];

export const collectionBySlug = (slug: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.slug === slug);
