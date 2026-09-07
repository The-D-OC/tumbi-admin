import { useState } from 'react';
import { isConfigured, supabase, type ClassRow, type OfferRow } from './lib/supabase';
import { useSession } from './lib/useSession';
import { ClassForm } from './components/ClassForm';
import { ClassList } from './components/ClassList';
import { OfferForm } from './components/OfferForm';
import { OfferList } from './components/OfferList';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';

type View =
  | { tab: 'dashboard' }
  | { tab: 'list' }
  | { tab: 'add' }
  | { tab: 'edit'; row: ClassRow }
  | { tab: 'offers' }
  | { tab: 'offer-add' }
  | { tab: 'offer-edit'; row: OfferRow };

function SetupScreen() {
  return (
    <div className="app setup">
      <div className="card">
        <h2>One-time setup</h2>
        <p className="subtle">The tool needs your Supabase credentials before it can connect.</p>
        <ol style={{ lineHeight: 1.8, fontSize: 15 }}>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> (local) or set the vars in Vercel.
          </li>
          <li>
            In the Supabase dashboard → <b>Project Settings → API</b>, copy the{' '}
            <b>Project URL</b> and the <b>publishable (anon)</b> key.
          </li>
          <li>
            Set them as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then
            restart / redeploy.
          </li>
        </ol>
        <pre>npm run dev</pre>
        <p className="subtle" style={{ marginTop: 16 }}>
          The publishable key is safe to ship — writes are protected by an admin login and Row Level
          Security.
        </p>
      </div>
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>({ tab: 'list' });
  const [reloadToken, setReloadToken] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const { session, isAdmin, loading } = useSession();

  if (!isConfigured) return <SetupScreen />;
  if (loading)
    return (
      <div className="app setup">
        <div className="card">
          <p className="subtle">Loading…</p>
        </div>
      </div>
    );
  if (!session) return <Login />;
  if (!isAdmin) return <Login notAdmin />;

  function afterSave(msg: string, backTo: View) {
    setFlash(msg);
    setReloadToken((t) => t + 1);
    setView(backTo);
    setTimeout(() => setFlash(null), 4000);
  }

  const onClassForm = view.tab === 'add' || view.tab === 'edit';
  const onOfferForm = view.tab === 'offer-add' || view.tab === 'offer-edit';
  const onOffersSection = view.tab === 'offers' || onOfferForm;
  const onClassesSection = view.tab === 'list' || onClassForm;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          Tumbi <span>Admin</span>
        </div>

        <nav className="nav">
          <button
            className={`nav-link ${view.tab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView({ tab: 'dashboard' })}
          >
            Dashboard
          </button>
          <button
            className={`nav-link ${onClassesSection ? 'active' : ''}`}
            onClick={() => setView({ tab: 'list' })}
          >
            Classes
          </button>
          <button
            className={`nav-link ${onOffersSection ? 'active' : ''}`}
            onClick={() => setView({ tab: 'offers' })}
          >
            Offers
          </button>
        </nav>

        <div className="inline" style={{ marginTop: 0, alignItems: 'center' }}>
          {onClassForm ? (
            <button className="pill-btn ghost" onClick={() => setView({ tab: 'list' })}>
              ← Back to list
            </button>
          ) : onOfferForm ? (
            <button className="pill-btn ghost" onClick={() => setView({ tab: 'offers' })}>
              ← Back to offers
            </button>
          ) : view.tab === 'list' ? (
            <button className="pill-btn" onClick={() => setView({ tab: 'add' })}>
              + Add class
            </button>
          ) : view.tab === 'offers' ? (
            <button className="pill-btn" onClick={() => setView({ tab: 'offer-add' })}>
              + Add offer
            </button>
          ) : null}
          <button className="nav-link" title="Sign out" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {flash && <div className="banner ok">{flash}</div>}

      {view.tab === 'dashboard' && <Dashboard />}

      {view.tab === 'list' && (
        <ClassList
          reloadToken={reloadToken}
          onEdit={(row) => setView({ tab: 'edit', row })}
          onChanged={(msg) => {
            setFlash(msg);
            setTimeout(() => setFlash(null), 4000);
          }}
        />
      )}

      {view.tab === 'add' && (
        <ClassForm
          onSaved={(msg) => afterSave(msg, { tab: 'list' })}
          onCancel={() => setView({ tab: 'list' })}
        />
      )}

      {view.tab === 'edit' && (
        <ClassForm
          initial={view.row}
          onSaved={(msg) => afterSave(msg, { tab: 'list' })}
          onCancel={() => setView({ tab: 'list' })}
        />
      )}

      {view.tab === 'offers' && (
        <OfferList
          reloadToken={reloadToken}
          onEdit={(row) => setView({ tab: 'offer-edit', row })}
          onChanged={(msg) => {
            setFlash(msg);
            setTimeout(() => setFlash(null), 4000);
          }}
        />
      )}

      {view.tab === 'offer-add' && (
        <OfferForm
          onSaved={(msg) => afterSave(msg, { tab: 'offers' })}
          onCancel={() => setView({ tab: 'offers' })}
        />
      )}

      {view.tab === 'offer-edit' && (
        <OfferForm
          initial={view.row}
          onSaved={(msg) => afterSave(msg, { tab: 'offers' })}
          onCancel={() => setView({ tab: 'offers' })}
        />
      )}
    </div>
  );
}
