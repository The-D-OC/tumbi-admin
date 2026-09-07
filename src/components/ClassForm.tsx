import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { classSchema, EMPTY_FORM, CATEGORIES, CATEGORY_LABELS } from '../lib/schema';
import type { FormShape, ClassFormValues } from '../lib/schema';
import { supabase, type ClassRow } from '../lib/supabase';
import { geocodeAddress } from '../lib/geocode';
import { Field } from './Field';
import { ScheduleEditor } from './ScheduleEditor';

// Turn an existing DB row back into raw form strings for editing.
function toForm(row: ClassRow): FormShape {
  const s = (v: string | null | undefined) => v ?? '';
  const n = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    name: s(row.name),
    provider_name: s(row.provider_name),
    description: s(row.description),
    category: s(row.category),
    age_min_months: n(row.age_min_months),
    age_max_months: n(row.age_max_months),
    price: n(row.price),
    price_note: s(row.price_note),
    phone: s(row.phone),
    website: s(row.website),
    email: s(row.email),
    address_line: s(row.address_line),
    city: s(row.city),
    postcode: s(row.postcode),
    latitude: n(row.latitude),
    longitude: n(row.longitude),
    image_url: s(row.image_url),
    what_to_bring: s(row.what_to_bring),
    what_to_expect: s(row.what_to_expect),
    schedule: Array.isArray(row.schedule) ? row.schedule.map((x) => ({ ...x })) : [],
    parking_available: !!row.parking_available,
    pram_friendly: !!row.pram_friendly,
    baby_changing: !!row.baby_changing,
    breastfeeding_friendly: !!row.breastfeeding_friendly,
    step_free_access: !!row.step_free_access,
    cafe: !!row.cafe,
    is_featured: !!row.is_featured,
    is_active: row.is_active ?? true,
  };
}

export function ClassForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: ClassRow | null;
  onSaved: (msg: string) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({
    // The resolver validates the raw form against the zod schema and hands the
    // transformed, type-safe values to onSubmit.
    resolver: zodResolver(classSchema) as unknown as Resolver<FormShape>,
    defaultValues: initial ? toForm(initial) : EMPTY_FORM,
    mode: 'onBlur',
  });

  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  async function findCoordinates() {
    setGeoNote(null);
    // The lookup only really needs a valid postcode — some venues have no street
    // name, so we don't block on the address here. A valid postcode alone places
    // the pin; the address just sharpens it when present.
    const ok = await trigger(['postcode']);
    if (!ok) {
      setGeoNote('Enter a valid postcode first — coordinates can be found from that alone.');
      return;
    }
    setGeoBusy(true);
    try {
      const { address_line, city, postcode } = getValues();
      const hit = await geocodeAddress({ address_line, city, postcode });
      if (!hit) {
        setGeoNote('Couldn’t find that location. Check the postcode, or type coordinates manually.');
        return;
      }
      setValue('latitude', String(hit.lat.toFixed(6)), { shouldValidate: true });
      setValue('longitude', String(hit.lng.toFixed(6)), { shouldValidate: true });
      const prefix =
        hit.precision === 'address'
          ? '📍 Found'
          : hit.precision === 'postcode'
            ? '📍 Found from postcode (approximate — check the pin)'
            : '📍 Found from town only (rough — check the pin)';
      setGeoNote(`${prefix}: ${hit.display}`);
    } catch {
      setGeoNote('Lookup failed (network). You can type coordinates manually.');
    } finally {
      setGeoBusy(false);
    }
  }

  const onSubmit = handleSubmit(async (raw) => {
    setBanner(null);
    // raw is already validated; parse once more to get the clean, transformed shape.
    const v = classSchema.parse(raw) as ClassFormValues;

    const payload = {
      name: v.name,
      provider_name: v.provider_name,
      description: v.description,
      category: v.category,
      age_min_months: v.age_min_months,
      age_max_months: v.age_max_months,
      price: v.price,
      price_note: v.price_note ?? null,
      phone: v.phone ?? null,
      website: v.website ?? null,
      email: v.email ?? null,
      address_line: v.address_line,
      city: v.city,
      postcode: v.postcode.toUpperCase(),
      latitude: v.latitude,
      longitude: v.longitude,
      image_url: v.image_url ?? null,
      what_to_bring: v.what_to_bring ?? null,
      what_to_expect: v.what_to_expect ?? null,
      schedule: v.schedule.length ? v.schedule : null,
      parking_available: v.parking_available,
      pram_friendly: v.pram_friendly,
      baby_changing: v.baby_changing,
      breastfeeding_friendly: v.breastfeeding_friendly,
      step_free_access: v.step_free_access,
      cafe: v.cafe,
      is_featured: v.is_featured,
      is_active: v.is_active,
    };

    try {
      if (initial) {
        const { error } = await supabase.from('classes').update(payload).eq('id', initial.id);
        if (error) throw error;
        onSaved(`Updated “${payload.name}”.`);
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
        onSaved(`Added “${payload.name}” to Tumbi.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong saving.';
      setBanner({ kind: 'err', text: `Save failed: ${msg}` });
    }
  });

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2>{initial ? 'Edit class' : 'Add a new class'}</h2>
      <p className="subtle">Fields marked * are required. The form won’t save until everything is valid.</p>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      <div className="section-title">The basics</div>
      <div className="grid">
        <Field label="Class name" required error={errors.name?.message} className="full">
          <input type="text" placeholder="e.g. Tiny Toes Sensory" {...register('name')} />
        </Field>
        <Field label="Provider / who runs it" required error={errors.provider_name?.message}>
          <input type="text" placeholder="e.g. Little Sparks Ltd" {...register('provider_name')} />
        </Field>
        <Field label="Category" required error={errors.category?.message}>
          <select {...register('category')} defaultValue={initial?.category ?? ''}>
            <option value="" disabled>
              Choose…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" required error={errors.description?.message} className="full">
          <textarea placeholder="What happens in the class, the vibe, who it suits…" {...register('description')} />
        </Field>
      </div>

      <div className="section-title">Ages & price</div>
      <div className="grid-3">
        <Field label="Min age (months)" required error={errors.age_min_months?.message}>
          <input type="number" min={0} placeholder="0" {...register('age_min_months')} />
        </Field>
        <Field label="Max age (months)" required error={errors.age_max_months?.message}>
          <input type="number" min={0} placeholder="12" {...register('age_max_months')} />
        </Field>
        <Field label="Price (£)" hint="blank if free/varies" error={errors.price?.message}>
          <input type="number" min={0} step="0.01" placeholder="8.50" {...register('price')} />
        </Field>
        <Field label="Price note" hint="optional" error={errors.price_note?.message} className="full">
          <input type="text" placeholder="e.g. First session free · £6 drop-in" {...register('price_note')} />
        </Field>
      </div>

      <div className="section-title">Location</div>
      <div className="grid">
        <Field label="Address" required error={errors.address_line?.message} className="full">
          <input type="text" placeholder="123 High Street" {...register('address_line')} />
        </Field>
        <Field label="Town / city" required error={errors.city?.message}>
          <input type="text" placeholder="Manchester" {...register('city')} />
        </Field>
        <Field label="Postcode" required error={errors.postcode?.message}>
          <input type="text" placeholder="M1 1AE" autoCapitalize="characters" {...register('postcode')} />
        </Field>
      </div>

      <div className="inline" style={{ marginTop: 8 }}>
        <Field label="Latitude" required error={errors.latitude?.message}>
          <input type="text" inputMode="decimal" placeholder="53.4808" {...register('latitude')} />
        </Field>
        <Field label="Longitude" required error={errors.longitude?.message}>
          <input type="text" inputMode="decimal" placeholder="-2.2426" {...register('longitude')} />
        </Field>
        <button type="button" className="pill-btn" onClick={findCoordinates} disabled={geoBusy}>
          {geoBusy ? 'Finding…' : 'Find coordinates'}
        </button>
      </div>
      {geoNote && <p className="subtle" style={{ marginTop: 6 }}>{geoNote}</p>}

      <div className="section-title">Contact & media</div>
      <div className="grid">
        <Field label="Phone" hint="optional" error={errors.phone?.message}>
          <input type="tel" placeholder="0161 000 0000" {...register('phone')} />
        </Field>
        <Field label="Email" hint="optional" error={errors.email?.message}>
          <input type="email" placeholder="hello@example.com" {...register('email')} />
        </Field>
        <Field label="Website" hint="optional" error={errors.website?.message}>
          <input type="url" placeholder="https://example.com" {...register('website')} />
        </Field>
        <Field label="Image URL" hint="optional" error={errors.image_url?.message}>
          <input type="url" placeholder="https://…/photo.jpg" {...register('image_url')} />
        </Field>
      </div>

      <div className="section-title">Weekly sessions</div>
      <ScheduleEditor control={control} register={register} errors={errors} />

      <div className="section-title">Facilities</div>
      <div className="checks">
        {(
          [
            ['pram_friendly', 'Pram friendly'],
            ['parking_available', 'Parking available'],
            ['baby_changing', 'Baby changing'],
            ['breastfeeding_friendly', 'Breastfeeding friendly'],
            ['step_free_access', 'Step-free access'],
            ['cafe', 'Café on site'],
          ] as const
        ).map(([key, label]) => (
          <label className="check" key={key}>
            <input type="checkbox" {...register(key)} />
            {label}
          </label>
        ))}
      </div>

      <div className="section-title">Extra detail</div>
      <div className="grid">
        <Field label="What to bring" hint="optional" error={errors.what_to_bring?.message}>
          <textarea placeholder="e.g. A towel and a change of clothes" {...register('what_to_bring')} />
        </Field>
        <Field label="What to expect" hint="optional" error={errors.what_to_expect?.message}>
          <textarea placeholder="e.g. 45 minutes of songs and sensory play" {...register('what_to_expect')} />
        </Field>
      </div>

      <div className="section-title">Visibility</div>
      <div className="checks">
        <label className="check">
          <input type="checkbox" {...register('is_active')} />
          Active (visible in the app)
        </label>
        <label className="check">
          <input type="checkbox" {...register('is_featured')} />
          Featured (shown on the home rail)
        </label>
      </div>

      <div className="footer-actions">
        <button type="button" className="pill-btn ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="pill-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : initial ? 'Save changes' : 'Add class'}
        </button>
      </div>
    </form>
  );
}
