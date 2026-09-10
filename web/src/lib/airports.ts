// IATA → {city, country}. Copy of skrendam/airports.json (canonical; tests/skrendam/test_shared_data.py
// fails if this drifts). Falls back to the IATA code.
import A from './airports.json';

const MAP = A as Record<string, { city: string; country: string }>;
export function city(iata: string): string { return MAP[iata]?.city ?? iata; }
export function country(iata: string): string { return MAP[iata]?.country ?? ''; }

/**
 * Tab labels for a set of origin codes. When two origins share a city name
 * (STN + LTN → "London") the label carries the code so the tabs stay
 * distinguishable: "London STN" / "London LTN". Unique cities stay bare.
 */
export function originLabels(codes: string[]): Map<string, string> {
  const byCity = new Map<string, number>();
  for (const code of codes) byCity.set(city(code), (byCity.get(city(code)) ?? 0) + 1);
  return new Map(
    codes.map((code) => {
      const c = city(code);
      return [code, (byCity.get(c) ?? 0) > 1 && c !== code ? `${c} ${code}` : c];
    }),
  );
}
