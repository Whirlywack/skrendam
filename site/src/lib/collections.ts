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

// Origin collections own the LT search terms (spec §5): „pigūs skrydžiai iš …".
// Their old English slugs 301 → these in next.config.ts redirects().
export const COLLECTIONS: Collection[] = [
  {
    slug: 'pigus-skrydziai-is-vilniaus',
    label: 'Pigūs skrydžiai iš Vilniaus',
    scene: 'ph-city',
    h1: 'Pigūs skrydžiai iš Vilniaus — atrinkti žmogaus',
    promise:
      'Tikrai pigios kainos iš Vilniaus, patikrintos žmogaus — prie kiekvienos: kodėl verta ir koks kabliukas.',
    filter: { kind: 'origin', iata: 'VNO' },
  },
  {
    slug: 'pigus-skrydziai-is-kauno',
    label: 'Pigūs skrydžiai iš Kauno',
    scene: 'ph-snow',
    h1: 'Pigūs skrydžiai iš Kauno — atrinkti žmogaus',
    promise: 'Žmogaus patikrintos pigios kainos iš Kauno.',
    filter: { kind: 'origin', iata: 'KUN' },
  },
  {
    slug: 'pigus-skrydziai-is-rygos',
    label: 'Pigūs skrydžiai iš Rygos',
    scene: 'ph-city',
    h1: 'Pigūs skrydžiai iš Rygos — atrinkti žmogaus',
    promise: 'Žmogaus patikrintos pigios kainos iš Rygos.',
    filter: { kind: 'origin', iata: 'RIX' },
  },
  {
    slug: 'september-sun-deals',
    label: 'Rugsėjo saulė',
    scene: 'ph-sun',
    h1: 'Pigūs skrydžiai į rugsėjo saulę iš Vilniaus, Kauno ir Rygos',
    promise: 'Vėlyvos vasaros šiluma, mažiau minios, mažesnės kainos — patikrinta žmogaus.',
    filter: { kind: 'moment', slug: 'sept_shoulder' },
  },
  {
    slug: 'christmas-market-flights',
    label: 'Kalėdų mugės',
    scene: 'ph-market',
    h1: 'Pigūs skrydžiai į Kalėdų muges iš Vilniaus, Kauno ir Rygos',
    promise: 'Savaitgalis prie karšto vyno geriausiose Europos mugėse.',
    filter: { kind: 'moment', slug: 'xmas_markets' },
  },
  {
    slug: 'cyprus-flight-deals-from-lithuania',
    label: 'Kipras iš Lietuvos',
    scene: 'ph-coast',
    h1: 'Pigūs skrydžiai į Kiprą iš Lietuvos',
    promise: 'Šiltos jūros Kipras iš Vilniaus ir Kauno.',
    filter: { kind: 'zone', zone: 'MEDITERRANEAN' },
  },
];

export const collectionBySlug = (slug: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.slug === slug);

// Interlink helpers — deal pages link the collections they belong to (SEO).
export const originCollection = (iata: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.filter.kind === 'origin' && c.filter.iata === iata);

export const zoneCollection = (zone: string | null | undefined): Collection | undefined =>
  zone ? COLLECTIONS.find((c) => c.filter.kind === 'zone' && c.filter.zone === zone) : undefined;
