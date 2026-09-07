import { useEffect, useMemo, useState } from 'react';
import { supabase, type ClassRow } from '../lib/supabase';
import { CATEGORY_LABELS } from '../lib/schema';

type StatusFilter = 'all' | 'active' | 'hidden' | 'featured';

export function ClassList({
  reloadToken,
  onEdit,
  onChanged,
}: {
  reloadToken: number;
  onEdit: (row: ClassRow) => void;
  onChanged: (msg: string) => void;
}) {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as ClassRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  // Optimistically patch a single field, rolling back if the write fails. This
  // avoids refetching the whole list on every quick toggle.
  async function patch(row: ClassRow, changes: Partial<ClassRow>, describe: string) {
    if (busyId) return;
    setBusyId(row.id);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...changes } : r)));
    const { error } = await supabase.from('classes').update(changes).eq('id', row.id);
    setBusyId(null);
    if (error) {
      setRows(prev);
      onChanged(`Update failed: ${error.message}`);
    } else {
      onChanged(describe);
    }
  }

  async function remove(row: ClassRow) {
    if (!confirm(`Delete “${row.name}”? This cannot be undone.`)) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== row.id)); // optimistic
    const { error } = await supabase.from('classes').delete().eq('id', row.id);
    if (error) {
      setRows(prev);
      onChanged(`Delete failed: ${error.message}`);
    } else {
      onChanged(`Deleted “${row.name}”.`);
    }
  }

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.is_active).length,
      hidden: rows.filter((r) => !r.is_active).length,
      featured: rows.filter((r) => r.is_featured).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'active' && !r.is_active) return false;
      if (status === 'hidden' && r.is_active) return false;
      if (status === 'featured' && !r.is_featured) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.provider_name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    });
  }, [rows, status, query]);

  const chips: { key: StatusFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'active', label: 'Live', n: counts.active },
    { key: 'hidden', label: 'Hidden', n: counts.hidden },
    { key: 'featured', label: 'Featured', n: counts.featured },
  ];

  return (
    <div className="card">
      <div className="list-head">
        <h2>Classes in Tumbi</h2>
        <p className="subtle">
          {filtered.length === rows.length
            ? `${rows.length} total · newest first`
            : `Showing ${filtered.length} of ${rows.length}`}
        </p>

        <input
          type="text"
          placeholder="Search by name, provider or town…"
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
      {error && <div className="banner err">Couldn’t load classes: {error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <p className="subtle">
          {rows.length === 0 ? 'No classes yet — add your first one.' : 'No matches for this filter.'}
        </p>
      )}

      {filtered.map((row) => {
        const busy = busyId === row.id;
        return (
          <div className={`list-row ${row.is_active ? '' : 'is-hidden'}`} key={row.id}>
            <div className="meta">
              <div className="name">
                {row.name}
                <span className="tag">{CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category}</span>
              </div>
              <div className="sub">
                {row.provider_name} · {row.city} · {row.age_min_months}–{row.age_max_months} mo
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
                  row.is_active ? `Hid “${row.name}”.` : `“${row.name}” is now live.`,
                )
              }
            >
              {row.is_active ? '● Live' : '○ Hidden'}
            </button>

            <button
              type="button"
              className={`toggle star ${row.is_featured ? 'on' : ''}`}
              disabled={busy}
              title={row.is_featured ? 'On the home rail — click to unfeature' : 'Click to feature on the home rail'}
              onClick={() =>
                patch(
                  row,
                  { is_featured: !row.is_featured },
                  row.is_featured ? `Unfeatured “${row.name}”.` : `Featured “${row.name}”.`,
                )
              }
            >
              {row.is_featured ? '★ Featured' : '☆ Feature'}
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
