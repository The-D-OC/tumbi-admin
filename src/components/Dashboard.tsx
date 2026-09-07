import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, CATEGORY_LABELS } from '../lib/schema';

// --- Row shapes (only the columns the dashboard needs). ---
type Profile = { id: string; created_at: string; baby_dob: string | null; home_postcode: string | null; referred_by: string | null; email: string | null; display_name: string | null };
type Klass = { id: string; name: string; category: string; city: string; is_active: boolean; is_featured: boolean; created_at: string };
type Review = { id: string; rating: number; created_at: string; class_id: string; author_name: string | null; body: string | null };
type Fav = { class_id: string; user_id: string };
type Offer = { kind: string; title: string; brand: string | null; is_active: boolean; is_sponsored: boolean };
type Push = { platform: string | null };

type Data = {
  profiles: Profile[];
  classes: Klass[];
  reviews: Review[];
  favourites: Fav[];
  offers: Offer[];
  push: Push[];
};

type DrillItem = { primary: string; secondary?: string };
type Drill = { title: string; items: DrillItem[] };

const DAY = 86_400_000;
const since = (days: number) => Date.now() - days * DAY;
const countSince = (rows: { created_at: string }[], days: number) =>
  rows.filter((r) => new Date(r.created_at).getTime() >= since(days)).length;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function monthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

type Range = 7 | 30 | 90 | 0;
const RANGES: { days: Range; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
];

type Bucket = { label: string; start: number; end: number };
function makeBuckets(range: Range, earliest: number): Bucket[] {
  const now = Date.now();
  if (range === 7) {
    return Array.from({ length: 7 }, (_, i) => {
      const idx = 6 - i;
      const start = now - (idx + 1) * DAY;
      const end = now - idx * DAY;
      const label = idx === 0 ? 'today' : new Date(end - DAY / 2).toLocaleDateString('en-GB', { weekday: 'short' });
      return { label, start, end };
    });
  }
  if (range === 0) {
    const startD = new Date(earliest);
    startD.setDate(1);
    startD.setHours(0, 0, 0, 0);
    const out: Bucket[] = [];
    const cur = new Date(startD);
    while (cur.getTime() <= now && out.length < 12) {
      const s = new Date(cur);
      const e = new Date(cur);
      e.setMonth(e.getMonth() + 1);
      out.push({ label: s.toLocaleDateString('en-GB', { month: 'short' }), start: s.getTime(), end: e.getTime() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out.length ? out : [{ label: 'now', start: now - DAY, end: now }];
  }
  const weeks = range === 30 ? 5 : 13;
  return Array.from({ length: weeks }, (_, i) => {
    const idx = weeks - 1 - i;
    const start = now - (idx + 1) * 7 * DAY;
    const end = now - idx * 7 * DAY;
    return { label: idx === 0 ? 'now' : `${idx}w`, start, end };
  });
}

export function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);
  const [drill, setDrill] = useState<Drill | null>(null);
  const drillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const [p, c, r, f, o, t] = await Promise.all([
        supabase.from('profiles').select('id, created_at, baby_dob, home_postcode, referred_by, email, display_name'),
        supabase.from('classes').select('id, name, category, city, is_active, is_featured, created_at'),
        supabase.from('reviews').select('id, rating, created_at, class_id, author_name, body'),
        supabase.from('favourites').select('class_id, user_id'),
        supabase.from('offers').select('kind, title, brand, is_active, is_sponsored'),
        supabase.from('push_tokens').select('platform'),
      ]);
      const firstErr = [p, c, r, f, o, t].find((x) => x.error)?.error;
      if (firstErr) {
        setError(firstErr.message);
        setLoading(false);
        return;
      }
      setData({
        profiles: (p.data ?? []) as Profile[],
        classes: (c.data ?? []) as Klass[],
        reviews: (r.data ?? []) as Review[],
        favourites: (f.data ?? []) as Fav[],
        offers: (o.data ?? []) as Offer[],
        push: (t.data ?? []) as Push[],
      });
      setLoading(false);
    })();
  }, []);

  // Close the drill-down on Escape, and scroll it into view when it opens.
  useEffect(() => {
    if (!drill) return;
    drillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrill(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drill]);

  const m = useMemo(() => {
    if (!data) return null;
    const { profiles, classes, reviews, favourites, offers, push } = data;

    const newInRange = range === 0 ? profiles.length : countSince(profiles, range);
    const withPostcode = profiles.filter((p) => p.home_postcode).length;
    const referred = profiles.filter((p) => p.referred_by).length;

    const earliest = profiles.length ? Math.min(...profiles.map((p) => new Date(p.created_at).getTime())) : Date.now();
    const buckets = makeBuckets(range, earliest).map((b) => ({
      ...b,
      n: profiles.filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= b.start && t < b.end;
      }).length,
    }));

    // Babies by age band (from baby_dob).
    const now = new Date();
    const bandOf = (dob: string) => {
      const mo = monthsBetween(new Date(dob), now);
      return mo < 6 ? 0 : mo < 12 ? 1 : mo < 24 ? 2 : 3;
    };
    const bandLabels = ['0–6 mo', '6–12 mo', '1–2 yr', '2 yr+'];
    const bands = bandLabels.map((label, i) => ({
      label,
      n: profiles.filter((p) => p.baby_dob && bandOf(p.baby_dob) === i).length,
    }));

    const active = classes.filter((c) => c.is_active).length;
    const featured = classes.filter((c) => c.is_featured).length;
    const byCategory = CATEGORIES.map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      n: classes.filter((c) => c.category === cat).length,
    })).sort((a, b) => b.n - a.n);
    const townMap = new Map<string, number>();
    for (const c of classes) townMap.set(c.city, (townMap.get(c.city) ?? 0) + 1);
    const topTowns = [...townMap.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 6);

    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const ratingDist = [5, 4, 3, 2, 1].map((star) => ({ star, label: `${star}★`, n: reviews.filter((r) => r.rating === star).length }));

    const favMap = new Map<string, number>();
    for (const f of favourites) favMap.set(f.class_id, (favMap.get(f.class_id) ?? 0) + 1);
    const nameById = new Map(classes.map((c) => [c.id, c.name]));
    const topSaved = [...favMap.entries()]
      .map(([id, n]) => ({ id, label: nameById.get(id) ?? 'Unknown', n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const savers = new Set(favourites.map((f) => f.user_id)).size;

    return {
      totals: { users: profiles.length, classes: classes.length, reviews: reviews.length, favourites: favourites.length, offers: offers.length, push: push.length },
      newInRange, withPostcode, referred, buckets, bands, bandOf,
      active, featured, byCategory, topTowns,
      avgRating, ratingDist,
      topSaved, savers, nameById,
    };
  }, [data, range]);

  if (loading) return <div className="card"><p className="subtle">Loading metrics…</p></div>;
  if (error) return <div className="card"><div className="banner err">Couldn’t load metrics: {error}</div></div>;
  if (!m || !data) return null;

  // --- Drill-down builders ---
  const nameOf = (p: Profile) => p.display_name || p.email || 'User';
  const profById = new Map(data.profiles.map((p) => [p.id, p]));
  const rangeLabel = RANGES.find((r) => r.days === range)!.label.toLowerCase();

  const usersDrill = (rows: Profile[], title: string): Drill => ({
    title,
    items: [...rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => ({ primary: nameOf(p), secondary: `joined ${shortDate(p.created_at)}${p.home_postcode ? ` · ${p.home_postcode}` : ''}` })),
  });
  const classesDrill = (rows: Klass[], title: string): Drill => ({
    title,
    items: rows.map((c) => ({ primary: c.name, secondary: `${c.city} · ${c.is_active ? 'live' : 'hidden'}${c.is_featured ? ' · featured' : ''}` })),
  });

  return (
    <div className="dash">
      <div className="dash-head">
        <span className="dash-title">Overview</span>
        <div className="range">
          {RANGES.map((r) => (
            <button key={r.days} className={`chip ${range === r.days ? 'active' : ''}`} onClick={() => setRange(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Users" value={m.totals.users} sub={`+${m.newInRange} in ${rangeLabel}`} accent onClick={() => setDrill(usersDrill(data.profiles, `All users (${m.totals.users})`))} />
        <Kpi label="Classes" value={m.totals.classes} sub={`${m.active} live · ${m.featured} featured`} onClick={() => setDrill(classesDrill(data.classes, `All classes (${m.totals.classes})`))} />
        <Kpi label="Reviews" value={m.totals.reviews} sub={m.totals.reviews ? `★ ${m.avgRating.toFixed(1)} avg` : 'none yet'} onClick={() => setDrill({ title: `Reviews (${m.totals.reviews})`, items: data.reviews.map((r) => ({ primary: `${'★'.repeat(r.rating)} ${m.nameById.get(r.class_id) ?? ''}`, secondary: `${r.author_name ?? 'Anon'}${r.body ? ` — ${r.body}` : ''}` })) })} />
        <Kpi label="Saves" value={m.totals.favourites} sub={`${m.savers} users saving`} onClick={() => setDrill({ title: `Saves (${m.totals.favourites})`, items: data.favourites.map((f) => ({ primary: m.nameById.get(f.class_id) ?? 'Unknown', secondary: `by ${profById.get(f.user_id) ? nameOf(profById.get(f.user_id)!) : 'user'}` })) })} />
        <Kpi label="Offers" value={m.totals.offers} sub={`${data.offers.filter((o) => o.is_active).length} active`} onClick={() => setDrill({ title: `Offers (${m.totals.offers})`, items: data.offers.map((o) => ({ primary: o.title, secondary: `${o.kind}${o.brand ? ` · ${o.brand}` : ''} · ${o.is_active ? 'active' : 'off'}` })) })} />
        <Kpi label="Push subs" value={m.totals.push} sub={m.totals.push ? 'notifiable' : 'none yet'} />
      </div>

      {drill && (
        <div className="drill-inline" ref={drillRef}>
          <div className="drill-head">
            <span className="drill-title">{drill.title}</span>
            <button className="drill-close" onClick={() => setDrill(null)} aria-label="Close">×</button>
          </div>
          <div className="drill-body">
            {drill.items.length === 0 && <p className="subtle">Nothing here.</p>}
            {drill.items.map((it, i) => (
              <div className="drill-row" key={i}>
                <span className="p">{it.primary}</span>
                {it.secondary && <span className="s">{it.secondary}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panels">
        <Panel title="New users" note={`${m.newInRange} in ${rangeLabel}`}>
          <Bars rows={m.buckets.map((b) => ({ label: b.label, n: b.n, onClick: () => setDrill(usersDrill(data.profiles.filter((p) => { const t = new Date(p.created_at).getTime(); return t >= b.start && t < b.end; }), `New users · ${b.label} (${b.n})`)) }))} />
        </Panel>

        <Panel title="Babies by age" note="from parent-set DOB">
          <BarList tint="ok" rows={m.bands.map((band, i) => ({ label: band.label, n: band.n, onClick: () => setDrill(usersDrill(data.profiles.filter((p) => p.baby_dob && m.bandOf(p.baby_dob) === i), `Babies · ${band.label} (${band.n})`)) }))} />
        </Panel>

        <Panel title="Classes by category">
          <BarList rows={m.byCategory.map((c) => ({ label: c.label, n: c.n, onClick: () => setDrill(classesDrill(data.classes.filter((k) => k.category === c.cat), `${c.label} (${c.n})`)) }))} />
        </Panel>

        <Panel title="Top towns" note="classes per town">
          <BarList rows={m.topTowns.map((t) => ({ label: t.label, n: t.n, onClick: () => setDrill(classesDrill(data.classes.filter((k) => k.city === t.label), `${t.label} (${t.n})`)) }))} />
        </Panel>

        <Panel title="Ratings" note={m.totals.reviews ? `★ ${m.avgRating.toFixed(1)} average` : 'no reviews yet'}>
          <BarList tint="accent" rows={m.ratingDist.map((d) => ({ label: d.label, n: d.n, onClick: d.n ? () => setDrill({ title: `${d.star}★ reviews (${d.n})`, items: data.reviews.filter((r) => r.rating === d.star).map((r) => ({ primary: m.nameById.get(r.class_id) ?? 'Class', secondary: `${r.author_name ?? 'Anon'}${r.body ? ` — ${r.body}` : ''}` })) }) : undefined }))} />
        </Panel>

        <Panel title="Most-saved classes">
          {m.topSaved.length ? (
            <BarList rows={m.topSaved.map((s) => ({ label: s.label, n: s.n, onClick: () => setDrill({ title: `Saved: ${s.label} (${s.n})`, items: data.favourites.filter((f) => f.class_id === s.id).map((f) => ({ primary: profById.get(f.user_id) ? nameOf(profById.get(f.user_id)!) : 'User' })) }) }))} />
          ) : (
            <p className="subtle">No saves yet.</p>
          )}
        </Panel>

        <Panel title="Audience quality" note="profile completeness">
          <Stat label="Postcode set" value={`${m.withPostcode}/${m.totals.users}`} />
          <Stat label="Referred sign-ups" value={m.referred} />
          <Stat label="Sponsored offers" value={data.offers.filter((o) => o.is_sponsored).length} />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent, onClick }: { label: string; value: number; sub: string; accent?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`kpi ${accent ? 'accent' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick} disabled={!onClick}>
      <div className="kpi-value">{value.toLocaleString()}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-sub">{sub}</div>
    </button>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {note && <span className="panel-note">{note}</span>}
      </div>
      {children}
    </div>
  );
}

type Row = { label: string; n: number; onClick?: () => void };

function Bars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="vbars">
      {rows.map((r, i) => (
        <button type="button" className={`vbar-col ${r.onClick ? 'clickable' : ''}`} key={i} onClick={r.onClick} disabled={!r.onClick}>
          <div className="vbar-track">
            <div className="vbar-fill" style={{ height: `${(r.n / max) * 100}%` }} />
          </div>
          <span className="vbar-n">{r.n}</span>
          <span className="vbar-label">{r.label}</span>
        </button>
      ))}
    </div>
  );
}

function BarList({ rows, tint }: { rows: Row[]; tint?: 'accent' | 'ok' }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <button type="button" className={`hbar ${r.onClick ? 'clickable' : ''}`} key={i} onClick={r.onClick} disabled={!r.onClick}>
          <span className="hbar-label" title={r.label}>{r.label}</span>
          <div className="hbar-track">
            <div className={`hbar-fill ${tint ?? ''}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <span className="hbar-n">{r.n}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
