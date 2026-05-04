export interface GeoProfile {
  name: string;
  weight: number;
  lat: number;
  lng: number;
  locale: string;
  tz: string;
}

export const geoProfiles: GeoProfile[] = [
  { name: 'us-west',    weight: 20, lat: 37.77,  lng: -122.41, locale: 'en-US', tz: 'America/Los_Angeles' },
  { name: 'us-east',    weight: 20, lat: 40.71,  lng: -74.00,  locale: 'en-US', tz: 'America/New_York' },
  { name: 'us-central', weight: 10, lat: 41.88,  lng: -87.63,  locale: 'en-US', tz: 'America/Chicago' },
  { name: 'uk',         weight: 10, lat: 51.50,  lng: -0.13,   locale: 'en-GB', tz: 'Europe/London' },
  { name: 'germany',    weight: 8,  lat: 52.52,  lng: 13.40,   locale: 'de-DE', tz: 'Europe/Berlin' },
  { name: 'india',      weight: 12, lat: 19.07,  lng: 72.87,   locale: 'en-IN', tz: 'Asia/Kolkata' },
  { name: 'japan',      weight: 8,  lat: 35.68,  lng: 139.69,  locale: 'ja-JP', tz: 'Asia/Tokyo' },
  { name: 'brazil',     weight: 7,  lat: -23.55, lng: -46.63,  locale: 'pt-BR', tz: 'America/Sao_Paulo' },
  { name: 'australia',  weight: 5,  lat: -33.87, lng: 151.21,  locale: 'en-AU', tz: 'Australia/Sydney' },
];
