// IATA → {city, country}. Copy of skrendam/airports.json (canonical; tests/skrendam/test_shared_data.py
// fails if this drifts). Falls back to the IATA code.
import A from './airports.json';

const MAP = A as Record<string, { city: string; country: string }>;
export function city(iata: string): string { return MAP[iata]?.city ?? iata; }
export function country(iata: string): string { return MAP[iata]?.country ?? ''; }
