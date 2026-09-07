import { useEffect, useMemo, useState } from 'react';
import { supabase, type OfferRow } from '../lib/supabase';
import { OFFER_KIND_LABELS } from '../lib/offerSchema';

type StatusFilter = 'all' | 'freebie' | 'offer' | 'active' | 'sponsored';

export function OfferList({
  reloadToken,
  onEdit,
  onChanged,
}: {
  reloadToken: number;
  onEdit: (row: OfferRow) => void;
  onChanged: (msg: string) => void;
}) {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as OfferRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  // Optimistically patch a single field, rolling back if the write fails.
  async function patch(row: OfferRow, changes: Partial<OfferRow>, describe: string) {
    if (busyId) return;
    setBusyId(row.id);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...changes } : r)));
    const { error } = await supabase.from('offers').update(changes).eq('id', row.id);
    setBusyId(null);
    if (error) {
      setRows(prev);
      onChanged(`Update failed: ${error.message}`);
    } else {
      onChanged(describe);
    }
  }

  async function remove(row: OfferRow) {
    if (!confirm(`Delete “${row.title}”? This cannot be undone.`)) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== row.id)); // optimistic
    const { error } = await supabase.from('offers').delete().eq('id', row.id);
    if (error) {
      setRows(prev);
      onChanged(`Delete failed: ${error.message}`);
    } else {
      onChanged(`Deleted “${row.title}”.`);
    }
  }

  const counts = useMemo(
    () => ({
      all: rows.length,
      freebie: rows.filter((r) => r.kind === 'freebie').length,
      offer: rows.filter((r) => r.kind === 'offer').length,
      active: rows.filter((r) => r.is_active).length,
      sponsored: rows.filter((r) => r.is_sponsored).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'freebie' && r.kind !== 'freebie') return false;
      if (status === 'offer' && r.kind !== 'offer') return false;
      if (status === 'active' && !r.is_active) return false;
      if (status === 'sponsored' && !r.is_sponsored) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.brand ?? '').toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, status, query]);

  const chips: { key: StatusFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'freebie', label: 'Freebies', n: counts.freebie },
    { key: 'offer', label: 'Offers', n: counts.offer },
    { key: 'active', label: 'Live', n: counts.active },
    { key: 'sponsored', label: 'Sponsored', n: counts.sponsored },
  ];

  return (
    <div className="card">
      <div className="list-head">
        <h2>Offers & freebies in Tumbi</h2>
        <p className="subtle">
          {filtered.length === rows.length
            ? `${rows.length} total · newest first`
            : `Showing ${filtered.length} of ${rows.length}`}
        </p>

        <input
          type="text"
          placeholder="Search by title, brand or location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="filters">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip ${status === c.key ? 'active' : ''}`}
              onClick={() => setStatus(c.key)}
            >
              {c.label} <span className="chip-n">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="subtle">Loading…</p>}
      {error && <div className="banner err">Couldn’t load offers: {error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <p className="subtle">
          {rows.length === 0 ? 'No offers yet — add your first one.' : 'No matches for this filter.'}
        </p>
      )}

      {filtered.map((row) => {
        const busy = busyId === row.id;
        return (
          <div className={`list-row ${row.is_active ? '' : 'is-hidden'}`} key={row.id}>
            <div className="meta">
              <div className="name">
                {row.title}
                <span className="tag">{OFFER_KIND_LABELS[row.kind]?.split(' ')[0] ?? row.kind}</span>
              </div>
              <div className="sub">
                {[row.brand, row.location].filter(Boolean).join(' · ') || 'No brand/location'}
              </div>
            </div>

            <button
              type="button"
              className={`toggle ${row.is_active ? 'on' : ''}`}
              disabled={busy}
              title={row.is_active ? 'Visible in the app — click to hide' : 'Hidden — click to make live'}
              onClick={() =>
                patch(
                  row,
                  { is_active: !row.is_active },
                  row.is_active ? `Hid “${row.title}”.` : `“${row.title}” is now live.`,
                )
              }
            >
              {row.is_active ? '● Live' : '○ Hidden'}
            </button>

            <button
              type="button"
              className={`toggle star ${row.is_sponsored ? 'on' : ''}`}
              disabled={busy}
              title={row.is_sponsored ? 'Sponsored — click to unmark' : 'Click to mark as sponsored'}
              onClick={() =>
                patch(
                  row,
                  { is_sponsored: !row.is_sponsored },
                  row.is_sponsored ? `Unmarked “${row.title}” as sponsored.` : `Marked “${row.title}” sponsored.`,
                )
              }
            >
              {row.is_sponsored ? '★ Sponsored' : '☆ Sponsor'}
            </button>

            <button className="link-btn" onClick={() => onEdit(row)}>
              Edit
            </button>
            <button className="link-btn danger" onClick={() => remove(row)}>
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
}
