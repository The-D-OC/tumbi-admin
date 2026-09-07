import { useState } from 'react';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  offerSchema,
  EMPTY_OFFER,
  OFFER_KINDS,
  OFFER_KIND_LABELS,
} from '../lib/offerSchema';
import type { OfferFormShape, OfferFormValues } from '../lib/offerSchema';
import { supabase, type OfferRow } from '../lib/supabase';
import { Field } from './Field';

// Turn an existing DB row back into raw form strings for editing.
function toForm(row: OfferRow): OfferFormShape {
  const s = (v: string | null | undefined) => v ?? '';
  return {
    kind: s(row.kind),
    title: s(row.title),
    description: s(row.description),
    brand: s(row.brand),
    location: s(row.location),
    valid_note: s(row.valid_note),
    code: s(row.code),
    url: s(row.url),
    how_to: Array.isArray(row.how_to) ? row.how_to.map((text) => ({ text })) : [],
    is_sponsored: !!row.is_sponsored,
    is_active: row.is_active ?? true,
  };
}

export function OfferForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: OfferRow | null;
  onSaved: (msg: string) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OfferFormShape>({
    resolver: zodResolver(offerSchema) as unknown as Resolver<OfferFormShape>,
    defaultValues: initial ? toForm(initial) : EMPTY_OFFER,
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'how_to' });
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const onSubmit = handleSubmit(async (raw) => {
    setBanner(null);
    // The zod resolver has already validated AND transformed these values, so use
    // them directly. Re-parsing would throw here — how_to is now a string[], not
    // the {text}[] the schema expects — which silently aborted the save.
    const v = raw as unknown as OfferFormValues;

    // Empty optional text → null. Works whether the resolver handed us "" or undefined.
    const orNull = (s?: string | null) => {
      const t = (s ?? '').toString().trim();
      return t ? t : null;
    };
    // how_to may arrive as string[] (transformed) or {text}[] (raw) — normalise both.
    const how_to = ((v.how_to ?? []) as Array<string | { text: string }>)
      .map((x) => (typeof x === 'string' ? x : x?.text ?? ''))
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      kind: v.kind,
      title: (v.title ?? '').toString().trim(),
      description: orNull(v.description),
      brand: orNull(v.brand),
      location: orNull(v.location),
      valid_note: orNull(v.valid_note),
      code: orNull(v.code),
      url: orNull(v.url),
      how_to, // jsonb column
      is_sponsored: !!v.is_sponsored,
      is_active: !!v.is_active,
    };

    try {
      if (initial) {
        const { error } = await supabase.from('offers').update(payload).eq('id', initial.id);
        if (error) throw error;
        onSaved(`Updated “${payload.title}”.`);
      } else {
        const { error } = await supabase.from('offers').insert(payload);
        if (error) throw error;
        onSaved(`Added “${payload.title}” to Tumbi.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong saving.';
      setBanner({ kind: 'err', text: `Save failed: ${msg}` });
    }
  });

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2>{initial ? 'Edit offer' : 'Add an offer or freebie'}</h2>
      <p className="subtle">Fields marked * are required. Everything else is optional.</p>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      <div className="section-title">The basics</div>
      <div className="grid">
        <Field label="Type" required error={errors.kind?.message}>
          <select {...register('kind')} defaultValue={initial?.kind ?? ''}>
            <option value="" disabled>
              Choose…
            </option>
            {OFFER_KINDS.map((k) => (
              <option key={k} value={k}>
                {OFFER_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand" hint="optional" error={errors.brand?.message}>
          <input type="text" placeholder="e.g. Boots" {...register('brand')} />
        </Field>
        <Field label="Title" required error={errors.title?.message} className="full">
          <input type="text" placeholder="e.g. Free baby welcome gift" {...register('title')} />
        </Field>
        <Field label="Description" hint="optional" error={errors.description?.message} className="full">
          <textarea placeholder="What the offer is and who it's for…" {...register('description')} />
        </Field>
      </div>

      <div className="section-title">Details</div>
      <div className="grid">
        <Field label="Location" hint="optional — e.g. Online, Boots stores" error={errors.location?.message}>
          <input type="text" placeholder="Online" {...register('location')} />
        </Field>
        <Field label="Valid note" hint="optional — eligibility / expiry" error={errors.valid_note?.message}>
          <input type="text" placeholder="e.g. Prime members only" {...register('valid_note')} />
        </Field>
        <Field label="Code" hint="optional — promo/voucher code" error={errors.code?.message}>
          <input type="text" placeholder="e.g. BABY20" {...register('code')} />
        </Field>
        <Field label="URL" hint="optional" error={errors.url?.message}>
          <input type="url" placeholder="https://example.com" {...register('url')} />
        </Field>
      </div>

      <div className="section-title">How to claim</div>
      <div>
        {fields.length === 0 && (
          <p className="subtle" style={{ marginBottom: 12 }}>
            No steps added yet. Add one line per step shown on the offer page (optional).
          </p>
        )}
        {fields.map((f, i) => (
          <div className="slot-row" key={f.id}>
            <Field label={`Step ${i + 1}`} error={errors.how_to?.[i]?.text?.message}>
              <input
                type="text"
                placeholder="e.g. Sign up with your email"
                {...register(`how_to.${i}.text` as const)}
              />
            </Field>
            <button type="button" className="icon-btn" title="Remove step" onClick={() => remove(i)}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="pill-btn ghost" onClick={() => append({ text: '' })}>
          + Add step
        </button>
      </div>

      <div className="section-title">Visibility</div>
      <div className="checks">
        <label className="check">
          <input type="checkbox" {...register('is_active')} />
          Active (visible in the app)
        </label>
        <label className="check">
          <input type="checkbox" {...register('is_sponsored')} />
          Sponsored (sorts first, shows a badge)
        </label>
      </div>

      <div className="footer-actions">
        <button type="button" className="pill-btn ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="pill-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : initial ? 'Save changes' : 'Add offer'}
        </button>
      </div>
    </form>
  );
}
