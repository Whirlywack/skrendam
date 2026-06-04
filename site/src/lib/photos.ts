// site/src/lib/photos.ts — IATA → warm "scene" class (Task 2 wires the Photo component to these).
const SCENE: Record<string, string> = {
  LCA: 'ph-coast', AGP: 'ph-coast', TFS: 'ph-coast', FAO: 'ph-coast', AYT: 'ph-coast',
  BCN: 'ph-city', BGY: 'ph-city', VIE: 'ph-city', PRG: 'ph-city', CIA: 'ph-city', STN: 'ph-city', CPH: 'ph-snow',
};
export function sceneClass(iata: string): string { return SCENE[iata] ?? 'ph-sun'; }
