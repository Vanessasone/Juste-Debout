/**
 * Ville → coordonnées (latitude, longitude) pour la carte du tour mondial.
 */
const CITY: Record<string, [number, number]> = {
  chongqing: [29.56, 106.55], tokyo: [35.68, 139.69], milan: [45.46, 9.19], paris: [48.85, 2.35],
  londres: [51.51, -0.13], 'new york': [40.71, -74.0], 'los angeles': [34.05, -118.24],
  séoul: [37.57, 126.98], seoul: [37.57, 126.98], dakar: [14.69, -17.44],
  'são paulo': [-23.55, -46.63], 'sao paulo': [-23.55, -46.63], berlin: [52.52, 13.4],
  madrid: [40.42, -3.7], lisbonne: [38.72, -9.14], rome: [41.9, 12.5], lyon: [45.76, 4.84],
  moscou: [55.75, 37.62], pékin: [39.9, 116.4], pekin: [39.9, 116.4], shanghai: [31.23, 121.47],
  osaka: [34.69, 135.5], bangkok: [13.76, 100.5], singapour: [1.35, 103.82], sydney: [-33.87, 151.21],
  toronto: [43.65, -79.38], montréal: [45.5, -73.57], montreal: [45.5, -73.57],
  amsterdam: [52.37, 4.9], bruxelles: [50.85, 4.35], mexico: [19.43, -99.13],
};

export function cityCoords(city?: string | null): [number, number] | null {
  if (!city) return null;
  return CITY[city.trim().toLowerCase()] ?? null;
}

/** Projection équirectangulaire → coordonnées SVG dans un viewBox 360×180. */
export function project(lat: number, lng: number): { x: number; y: number } {
  return { x: lng + 180, y: 90 - lat };
}
