// IATA → {city, country} map for the origins/destinations the engine scans.
// Extends beyond placeholder with all seeded origins + scanned destinations.
// Falls back to the IATA code when not found.
const A: Record<string, { city: string; country: string }> = {
  VNO: { city: 'Vilnius', country: 'Lithuania' },
  KUN: { city: 'Kaunas', country: 'Lithuania' },
  RIX: { city: 'Riga', country: 'Latvia' },
  AGP: { city: 'Málaga', country: 'Spain' },
  AYT: { city: 'Antalya', country: 'Türkiye' },
  BCN: { city: 'Barcelona', country: 'Spain' },
  BGY: { city: 'Bergamo', country: 'Italy' },
  CIA: { city: 'Rome', country: 'Italy' },
  CPH: { city: 'Copenhagen', country: 'Denmark' },
  LCA: { city: 'Larnaca', country: 'Cyprus' },
  PRG: { city: 'Prague', country: 'Czechia' },
  STN: { city: 'London', country: 'United Kingdom' },
  TFS: { city: 'Tenerife', country: 'Spain' },
  VIE: { city: 'Vienna', country: 'Austria' },
};
export function city(iata: string): string { return A[iata]?.city ?? iata; }
export function country(iata: string): string { return A[iata]?.country ?? ''; }
