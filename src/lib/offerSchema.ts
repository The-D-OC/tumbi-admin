import { z } from 'zod';

// Offers vs freebies live in the same `offers` table, distinguished by `kind`.
export const OFFER_KINDS = ['freebie', 'offer'] as const;

export const OFFER_KIND_LABELS: Record<(typeof OFFER_KINDS)[number], string> = {
  freebie: 'Freebie (free stuff)',
  offer: 'Offer / discount',
};

// A blank optional text field arrives as "" from inputs — treat as "not set".
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), 'Enter a full URL (https://…)');

export const offerSchema = z.object({
  kind: z.enum(OFFER_KINDS, { errorMap: () => ({ message: 'Choose offer or freebie' }) }),
  title: z.string().trim().min(2, 'Give it a title (min 2 characters)').max(160),
  description: optionalTrimmed,
  brand: optionalTrimmed,
  location: optionalTrimmed,
  valid_note: optionalTrimmed,
  code: optionalTrimmed,
  url: optionalUrl,

  // Step-by-step "how to claim" instructions. Blank rows are stripped on submit.
  how_to: z
    .array(z.object({ text: z.string().trim() }))
    .default([])
    .transform((rows) => rows.map((r) => r.text).filter((t) => t.length > 0)),

  is_sponsored: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

// Output type (validated/coerced — what we send to Supabase). Note how_to is string[].
export type OfferFormValues = z.output<typeof offerSchema>;

// Raw shape the form fields hold before validation.
export type OfferFormShape = {
  kind: string;
  title: string;
  description: string;
  brand: string;
  location: string;
  valid_note: string;
  code: string;
  url: string;
  how_to: { text: string }[];
  is_sponsored: boolean;
  is_active: boolean;
};

/** Blank form for the "add new" case. */
export const EMPTY_OFFER: OfferFormShape = {
  kind: '',
  title: '',
  description: '',
  brand: '',
  location: '',
  valid_note: '',
  code: '',
  url: '',
  how_to: [],
  is_sponsored: false,
  is_active: true,
};
