import { z } from 'zod';

// The 8 categories the Tumbi app knows how to render (src/lib/theme.ts → Category).
// Anything else would fall back to "other" in the app, so we constrain to these.
export const CATEGORIES = [
  'sensory',
  'music',
  'swimming',
  'yoga',
  'massage',
  'mums',
  'movement',
  'other',
] as const;

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  sensory: 'Sensory play',
  music: 'Music & singing',
  swimming: 'Swimming',
  yoga: 'Baby yoga',
  massage: 'Baby massage',
  mums: 'Mums & wellbeing',
  movement: 'Movement & dance',
  other: 'Other',
};

// The app matches schedule days with a lowercase full-name lookup (see the app's
// calendar.ts), so we store them lowercase: "monday", "tuesday", …
export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// HH:mm 24-hour time.
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Loose UK postcode (case-insensitive, optional single space).
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
// UK phone: digits, spaces, +, -, parens; 7–20 chars.
const PHONE_RE = /^[+()\d][\d\s()-]{6,19}$/;

// A blank optional text field arrives as "" from inputs — treat as "not set".
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

// Number inputs give us "" when empty and a string otherwise. Map ""/blank/NaN
// to `undefined` so a required field errors properly instead of coercing "" → 0.
const emptyToUndefined = (v: unknown) => {
  if (v === '' || v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
};

/** A required numeric field with a single friendly message for empty/invalid. */
function requiredNumber(message: string) {
  return z.preprocess(
    emptyToUndefined,
    z.number({ required_error: message, invalid_type_error: message }),
  );
}

const scheduleSlot = z
  .object({
    day: z.enum(DAYS, { errorMap: () => ({ message: 'Pick a day' }) }),
    start_time: z.string().regex(TIME_RE, 'Use HH:mm (e.g. 09:30)'),
    end_time: z.string().regex(TIME_RE, 'Use HH:mm (e.g. 10:30)'),
  })
  .refine((s) => s.end_time > s.start_time, {
    message: 'End time must be after the start time',
    path: ['end_time'],
  });

export const classSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the class a name (min 2 characters)').max(120),
    provider_name: z.string().trim().min(2, 'Who runs it? (min 2 characters)').max(120),
    description: z.string().trim().min(10, 'Add a short description (min 10 characters)').max(2000),

    category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),

    age_min_months: requiredNumber('Enter the minimum age in months').pipe(
      z.number().int('Whole months only').min(0, 'Cannot be negative').max(216, 'That seems too high'),
    ),
    age_max_months: requiredNumber('Enter the maximum age in months').pipe(
      z.number().int('Whole months only').min(0, 'Cannot be negative').max(216, 'That seems too high'),
    ),

    // Price in £. Empty = not set (null); use price_note for "from £5" style text.
    price: z.preprocess(
      emptyToUndefined,
      z
        .number()
        .min(0, 'Cannot be negative')
        .max(1000, 'That seems too high')
        .optional()
        .transform((v) => (v == null ? null : v)),
    ),
    price_note: optionalTrimmed,

    phone: optionalTrimmed.refine((v) => !v || PHONE_RE.test(v), 'Enter a valid phone number'),
    website: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), 'Enter a full URL (https://…)'),
    email: optionalTrimmed.refine(
      (v) => !v || z.string().email().safeParse(v).success,
      'Enter a valid email',
    ),

    address_line: z.string().trim().min(3, 'Enter the street address'),
    city: z.string().trim().min(2, 'Enter the town/city'),
    postcode: z
      .string()
      .trim()
      .min(1, 'Enter the postcode')
      .refine((v) => UK_POSTCODE_RE.test(v), 'Enter a valid UK postcode (e.g. M1 1AE)'),

    latitude: requiredNumber('Use “Find coordinates” to set this').pipe(
      z
        .number()
        .min(49, 'Outside the UK — use “Find coordinates”')
        .max(61, 'Outside the UK — use “Find coordinates”'),
    ),
    longitude: requiredNumber('Use “Find coordinates” to set this').pipe(
      z
        .number()
        .min(-9, 'Outside the UK — use “Find coordinates”')
        .max(2.2, 'Outside the UK — use “Find coordinates”'),
    ),

    image_url: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), 'Enter a full image URL (https://…)'),

    what_to_bring: optionalTrimmed,
    what_to_expect: optionalTrimmed,

    schedule: z.array(scheduleSlot).default([]),

    parking_available: z.boolean().default(false),
    pram_friendly: z.boolean().default(false),
    baby_changing: z.boolean().default(false),
    breastfeeding_friendly: z.boolean().default(false),
    step_free_access: z.boolean().default(false),
    cafe: z.boolean().default(false),

    is_featured: z.boolean().default(false),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.age_max_months >= v.age_min_months, {
    message: 'Max age must be greater than or equal to min age',
    path: ['age_max_months'],
  });

// Output type (validated, coerced — what we send to Supabase).
export type ClassFormValues = z.output<typeof classSchema>;

// The raw shape the form fields actually hold: number inputs are strings, the
// category starts blank, schedule times are strings. We validate/transform this
// into ClassFormValues via the zod resolver on submit.
export type FormShape = {
  name: string;
  provider_name: string;
  description: string;
  category: string;
  age_min_months: string;
  age_max_months: string;
  price: string;
  price_note: string;
  phone: string;
  website: string;
  email: string;
  address_line: string;
  city: string;
  postcode: string;
  latitude: string;
  longitude: string;
  image_url: string;
  what_to_bring: string;
  what_to_expect: string;
  schedule: { day: string; start_time: string; end_time: string }[];
  parking_available: boolean;
  pram_friendly: boolean;
  baby_changing: boolean;
  breastfeeding_friendly: boolean;
  step_free_access: boolean;
  cafe: boolean;
  is_featured: boolean;
  is_active: boolean;
};

/** Blank form for the "add new" case. */
export const EMPTY_FORM: FormShape = {
  name: '',
  provider_name: '',
  description: '',
  category: '',
  age_min_months: '',
  age_max_months: '',
  price: '',
  price_note: '',
  phone: '',
  website: '',
  email: '',
  address_line: '',
  city: '',
  postcode: '',
  latitude: '',
  longitude: '',
  image_url: '',
  what_to_bring: '',
  what_to_expect: '',
  schedule: [],
  parking_available: false,
  pram_friendly: false,
  baby_changing: false,
  breastfeeding_friendly: false,
  step_free_access: false,
  cafe: false,
  is_featured: false,
  is_active: true,
};
