/**
 * frontend/src/components/geographic/countries.ts
 *
 * Country geographic data & coordinate structures for interactive 3D Globe.
 * Supports: Country selection, ISO lookup, lat/long to 3D Cartesian conversions.
 */

export interface CountryData {
  name: string;
  isoCode: string;
  lat: number;
  lng: number;
  region: string;
  activeUsers?: number;
}

export const COUNTRIES: CountryData[] = [
  { name: "India", isoCode: "IN", lat: 20.5937, lng: 78.9629, region: "Asia", activeUsers: 42 },
  { name: "United States", isoCode: "US", lat: 37.0902, lng: -95.7129, region: "North America", activeUsers: 38 },
  { name: "United Kingdom", isoCode: "GB", lat: 55.3781, lng: -3.436, region: "Europe", activeUsers: 24 },
  { name: "Germany", isoCode: "DE", lat: 51.1657, lng: 10.4515, region: "Europe", activeUsers: 19 },
  { name: "Japan", isoCode: "JP", lat: 36.2048, lng: 138.2529, region: "Asia", activeUsers: 31 },
  { name: "Brazil", isoCode: "BR", lat: -14.235, lng: -51.9253, region: "South America", activeUsers: 15 },
  { name: "Australia", isoCode: "AU", lat: -25.2744, lng: 133.7751, region: "Oceania", activeUsers: 12 },
  { name: "Canada", isoCode: "CA", lat: 56.1304, lng: -106.3468, region: "North America", activeUsers: 18 },
  { name: "France", isoCode: "FR", lat: 46.2276, lng: 2.2137, region: "Europe", activeUsers: 14 },
  { name: "South Korea", isoCode: "KR", lat: 35.9078, lng: 127.7669, region: "Asia", activeUsers: 22 },
  { name: "Singapore", isoCode: "SG", lat: 1.3521, lng: 103.8198, region: "Asia", activeUsers: 16 },
  { name: "Netherlands", isoCode: "NL", lat: 52.1326, lng: 5.2913, region: "Europe", activeUsers: 11 },
  { name: "United Arab Emirates", isoCode: "AE", lat: 23.4241, lng: 53.8478, region: "Middle East", activeUsers: 13 },
];

/**
 * Converts Latitude and Longitude to 3D Cartesian coordinates (x, y, z) on a sphere of radius R.
 */
export function latLngToVector3(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return [x, y, z];
}
