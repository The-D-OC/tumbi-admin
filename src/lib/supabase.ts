import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the env is filled in — the app shows a setup screen otherwise. */
export const isConfigured =
  Boolean(url) && Boolean(anonKey) && anonKey !== 'your-publishable-key-here';

// Hosted-safe admin client. Uses the PUBLISHABLE (anon) key — safe to ship to the
// browser because it grants no privileges of its own. Writes are gated by an
// admin login + Row Level Security (only rows the signed-in admin may touch).
// We persist the session so a refresh keeps you logged in.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ---- Types mirroring the Tumbi `classes` table (see baby-class-finder). ----

export type ScheduleSlot = { day: string; start_time: string; end_time: string };

export type ClassRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  age_min_months: number;
  age_max_months: number;
  price: number | null;
  price_note: string | null;
  provider_name: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address_line: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  schedule: ScheduleSlot[] | null;
  parking_available: boolean | null;
  pram_friendly: boolean | null;
  baby_changing: boolean | null;
  breastfeeding_friendly: boolean | null;
  step_free_access: boolean | null;
  cafe: boolean | null;
  what_to_bring: string | null;
  what_to_expect: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
};

// ---- Types mirroring the Tumbi `offers` table (offers + freebies). ----

export type OfferKind = 'freebie' | 'offer';

export type OfferRow = {
  id: string;
  kind: OfferKind;
  title: string;
  description: string | null;
  brand: string | null;
  location: string | null;
  valid_note: string | null;
  code: string | null;
  url: string | null;
  how_to: string[] | null; // jsonb array of "how to claim" steps
  is_sponsored: boolean;
  is_active: boolean;
  created_at: string;
};
