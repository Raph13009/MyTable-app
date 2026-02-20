export type RegionBBox = [number, number, number, number]

export interface RegionMeta {
  code: string
  name: string
  slug: string
  bbox: RegionBBox
}

export interface RegionCardMeta {
  specialties: string
  cta: string
}

export const FRANCE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-5.5, 41],
  [9.8, 51.5],
]

export const FRANCE_CENTER: [number, number] = [2.2137, 46.2276]
export const FRANCE_ZOOM = 5.5

export const REGIONS_FRANCE_METRO: RegionMeta[] = [
  { code: '11', name: 'Île-de-France', slug: 'ile-de-france', bbox: [1.44645, 48.12054, 3.55851, 49.24131] },
  { code: '24', name: 'Centre-Val de Loire', slug: 'centre-val-de-loire', bbox: [0.05297, 46.34719, 3.12857, 48.94105] },
  { code: '27', name: 'Bourgogne-Franche-Comté', slug: 'bourgogne-franche-comte', bbox: [2.84519, 46.15594, 7.14346, 48.39939] },
  { code: '28', name: 'Normandie', slug: 'normandie', bbox: [-1.94808, 48.17989, 1.80268, 50.07203] },
  { code: '32', name: 'Hauts-de-France', slug: 'hauts-de-france', bbox: [1.38065, 48.83944, 4.2557, 51.089] },
  { code: '44', name: 'Grand Est', slug: 'grand-est', bbox: [3.38336, 47.42022, 8.23334, 50.16912] },
  { code: '52', name: 'Pays de la Loire', slug: 'pays-de-la-loire', bbox: [-2.62341, 46.26651, 0.91665, 48.56799] },
  { code: '53', name: 'Bretagne', slug: 'bretagne', bbox: [-5.14026, 47.2784, -1.01577, 48.90064] },
  { code: '75', name: 'Nouvelle-Aquitaine', slug: 'nouvelle-aquitaine', bbox: [-1.79235, 42.77752, 2.61157, 47.17576] },
  { code: '76', name: 'Occitanie', slug: 'occitanie', bbox: [-0.32717, 42.33305, 4.84555, 45.04669] },
  { code: '84', name: 'Auvergne-Rhône-Alpes', slug: 'auvergne-rhone-alpes', bbox: [2.06291, 44.11538, 7.18589, 46.80401] },
  { code: '93', name: "Provence-Alpes-Côte d'Azur", slug: 'provence-alpes-cote-d-azur', bbox: [4.23028, 42.98181, 7.71881, 45.12685] },
  { code: '94', name: 'Corse', slug: 'corse', bbox: [8.53514, 41.33363, 9.55996, 43.02766] },
]

export const REGION_CARD_META_BY_CODE: Record<string, RegionCardMeta> = {
  '11': { specialties: 'Bistro moderne, pâtisserie fine', cta: 'Découvrir les chefs d’Île-de-France' },
  '24': { specialties: 'Cuisine de terroir, vins de Loire', cta: 'Découvrir les chefs du Centre-Val de Loire' },
  '27': { specialties: 'Comté, vins de Bourgogne, cuisine jurassienne', cta: 'Découvrir les chefs de Bourgogne-Franche-Comté' },
  '28': { specialties: 'Produits de la mer, cuisine normande', cta: 'Découvrir les chefs de Normandie' },
  '32': { specialties: 'Brasserie du Nord, inspirations flamandes', cta: 'Découvrir les chefs des Hauts-de-France' },
  '44': { specialties: 'Traditions alsaciennes, table contemporaine', cta: 'Découvrir les chefs du Grand Est' },
  '52': { specialties: 'Cuisine atlantique, terroirs ligériens', cta: 'Découvrir les chefs des Pays de la Loire' },
  '53': { specialties: 'Cuisine bretonne, produits iodés', cta: 'Découvrir les chefs de Bretagne' },
  '75': { specialties: 'Cuisine basque, bordelaise et landaise', cta: 'Découvrir les chefs de Nouvelle-Aquitaine' },
  '76': { specialties: 'Méditerranée, Sud-Ouest, cuisines occitanes', cta: 'Découvrir les chefs d’Occitanie' },
  '84': { specialties: 'Savoie, Lyonnaise, gastronomie alpine', cta: 'Découvrir les chefs d’Auvergne-Rhône-Alpes' },
  '93': { specialties: 'Saveurs provençales, cuisine azuréenne', cta: "Découvrir les chefs de Provence-Alpes-Côte d'Azur" },
  '94': { specialties: 'Cuisine corse, produits insulaires', cta: 'Découvrir les chefs de Corse' },
}

export function slugifyRegionName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function getRegionBySlug(slug: string | null | undefined): RegionMeta | null {
  if (!slug) return null
  const normalized = slugifyRegionName(slug)
  return REGIONS_FRANCE_METRO.find((region) => region.slug === normalized) || null
}

export function getRegionBBoxBySlug(slug: string | null | undefined): RegionBBox | null {
  return getRegionBySlug(slug)?.bbox || null
}

export function getRegionByCode(code: string | null | undefined): RegionMeta | null {
  if (!code) return null
  return REGIONS_FRANCE_METRO.find((region) => region.code === code) || null
}
