// IATA airline code → display name. Copy of skrendam/airlines.json (canonical;
// tests/skrendam/test_shared_data.py fails if this drifts). Falls back to the code.
import A from './airlines.json';

const MAP = A as Record<string, string>;
export function airlineName(code: string): string { return MAP[code] ?? code; }
