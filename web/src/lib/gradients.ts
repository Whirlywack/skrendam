// Deterministic, on-brand card gradient per zone (real data has no gradient field).
const G: Record<string, string> = {
  MEDITERRANEAN: 'linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)',
  CANARIES: 'linear-gradient(150deg,#F2B84B,#E06A1F 70%,#9C520A)',
  WESTERN_EUROPE: 'linear-gradient(150deg,#3FB3A6,#1F7A86 70%,#0E4C52)',
  SCANDINAVIA: 'linear-gradient(150deg,#7FC9C0,#2E8E93 70%,#15585E)',
  CITY_BREAKS: 'linear-gradient(150deg,#E9A23B,#C2531E 70%,#7E3D12)',
};
export function gradientForZone(zone: string | null): string {
  return (zone && G[zone]) || 'linear-gradient(150deg,#EFA227,#C2531E 70%,#7E3D12)';
}
