// Look up latitude/longitude from a UK address using OpenStreetMap's free
// Nominatim service — no API key required. This keeps you from ever hand-typing
// coordinates. Nominatim asks for a descriptive User-Agent and light usage
// (a handful of requests per lookup at most, on a button press), which we respect.

// How precise the match was, so the UI can warn when it's only postcode/town level.
export type GeoPrecision = 'address' | 'postcode' | 'city';

export type GeoResult = { lat: number; lng: number; display: string; precision: GeoPrecision };

type Hit = { lat: number; lng: number; display: string };

async function nominatim(params: Record<string, string>): Promise<Hit | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'gb', ...params }).toString();

  const res = await fetch(url, { headers: { 'Accept-Language': 'en-GB' } });
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);

  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const top = rows[0];
  if (!top) return null;

  const lat = parseFloat(top.lat);
  const lng = parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, display: top.display_name };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geocodeAddress(parts: {
  address_line?: string;
  city?: string;
  postcode?: string;
}): Promise<GeoResult | null> {
  const address_line = (parts.address_line ?? '').trim();
  const city = (parts.city ?? '').trim();
  const postcode = (parts.postcode ?? '').trim();

  // Try the most specific query first and fall back progressively. Some venues
  // have no usable street name, so a valid postcode alone is enough to place the
  // pin (via Nominatim's structured `postalcode` lookup, which returns the
  // postcode centroid). Town-only is the last resort.
  const attempts: { params: Record<string, string>; precision: GeoPrecision }[] = [];

  if (address_line) {
    attempts.push({
      params: { q: [address_line, city, postcode, 'United Kingdom'].filter(Boolean).join(', ') },
      precision: 'address',
    });
  }
  if (postcode) {
    // Structured postcode lookup is the reliable centroid for "no street" venues.
    attempts.push({
      params: city ? { postalcode: postcode, city } : { postalcode: postcode },
      precision: 'postcode',
    });
    // Free-text fallback in case the structured lookup misses the postcode.
    attempts.push({ params: { q: `${postcode}, United Kingdom` }, precision: 'postcode' });
  }
  if (city) {
    attempts.push({ params: { q: `${city}, United Kingdom` }, precision: 'city' });
  }

  if (!attempts.length) return null;

  for (let i = 0; i < attempts.length; i++) {
    // Be polite to Nominatim (~1 req/sec) between fallbacks. Most lookups hit on
    // the first attempt and never wait.
    if (i > 0) await sleep(1100);
    const hit = await nominatim(attempts[i].params);
    if (hit) return { ...hit, precision: attempts[i].precision };
  }
  return null;
}
