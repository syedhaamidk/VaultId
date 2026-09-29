import {
  ShieldCheck, ChevronRight, Zap, Bell, Lock, Globe, LogOut,
  Loader2, Download, Upload, Clock, CreditCard, Activity, Wallet, Home, Scale, FolderOpen, Smartphone,
} from 'lucide-react';
import { VAULT_CAT } from '../../data.js';
import { usePwaInstall } from '../../utils/usePwaInstall.js';

const CAT_ICONS = {
  all: FolderOpen, identity: CreditCard, medical: Activity,
  financial: Wallet, property: Home, legal: Scale,
};

/**
 * Sidebar navigation.
 */
export default function Sidebar({
  sbCollapsed, setSbCollapsed, cat, setCat, docs, onEmergency, onAlerts, notifOpen, notifs,
  onPinChange, onExport, onImport, onAuditLog, onLock, onBack, user, authBusy,
  onGoogleSignIn, onSignOut, syncing, syncErr, supabaseEnabled,
}) {
  const { canInstall, installed, promptInstall } = usePwaInstall();
  return (
    <aside className={`asidebar${sbCollapsed ? ' collapsed' : ''}`} style={{ width: sbCollapsed ? 64 : 215, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--bd)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ padding: '8px 10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={17} color="#fff" />
        </div>
        <span className="gtext sb-logo-text" style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.4px', fontFamily: "'Space Grotesk', sans-serif", flex: 1 }}>VaultID</span>
        {!sbCollapsed && (
          <button className="sb-collapse-btn" onClick={() => setSbCollapsed(true)} title="Collapse sidebar">
            <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>
      {sbCollapsed && (
        <button className="sb-collapse-btn" style={{ margin: '0 auto 10px' }} onClick={() => setSbCollapsed(false)} title="Expand sidebar">
          <ChevronRight size={13} />
        </button>
      )}

      <p className="lbl sb-label" style={{ padding: '0 10px 6px' }}>Library</p>
      {Object.entries(VAULT_CAT).map(([k, m]) => {
        const Ic = CAT_ICONS[k] ?? FolderOpen;
        const cnt = k === 'all' ? docs.length : docs.filter((d) => d.cat === k).length;
        return (
          <button
            type="button"
            key={k}
            className={`anv${cat === k ? ' on' : ''}`}
            onClick={() => setCat(k)}
            data-tip={sbCollapsed ? m.label : undefined}
            aria-label={m.label}
            aria-pressed={cat === k}
          >
            <Ic size={15} /><span style={{ flex: 1 }}>{m.label}</span>
            <span className="cnt">{cnt}</span>
          </button>
        );
      })}

      <div className="divr" />
      <button type="button" className="anv danger" onClick={onEmergency} data-tip={sbCollapsed ? 'Emergency Card' : undefined} aria-label="Emergency Card">
        <Zap size={15} /><span style={{ flex: 1 }}>Emergency Card</span><ChevronRight size={13} />
      </button>
      <button type="button" className="anv" onClick={onAlerts} data-tip={sbCollapsed ? 'Alerts' : undefined} aria-label="Alerts" aria-expanded={notifOpen}>
        <Bell size={15} /><span style={{ flex: 1 }}>Alerts</span>
        {notifs.length > 0 && (
          <span style={{ background: 'var(--re)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
            {notifs.length}
          </span>
        )}
      </button>
      <button type="button" className="anv" onClick={onPinChange} data-tip={sbCollapsed ? 'Change PIN' : undefined} aria-label="Change PIN">
        <Lock size={15} /><span style={{ flex: 1 }}>Change PIN</span>
      </button>

      <div style={{ flex: 1 }} />
      <div className="divr" />

      <button type="button" className="anv" style={{ color: 'var(--tx3)' }} data-tip={sbCollapsed ? 'Audit log' : undefined} aria-label="Audit log" onClick={onAuditLog}>
        <Clock size={15} /><span style={{ flex: 1, fontSize: 13 }}>Audit Log</span>
      </button>
      <button type="button" className="anv" style={{ color: 'var(--tx3)' }} data-tip={sbCollapsed ? 'Export vault' : undefined} aria-label="Export vault" onClick={onExport}>
        <Download size={15} /><span style={{ flex: 1, fontSize: 13 }}>Export</span>
      </button>
      <button type="button" className="anv" style={{ color: 'var(--tx3)' }} data-tip={sbCollapsed ? 'Import vault' : undefined} aria-label="Import vault" onClick={onImport}>
        <Upload size={15} /><span style={{ flex: 1, fontSize: 13 }}>Import</span>
      </button>
      {canInstall && !installed && (
        <button type="button" className="anv" style={{ color: 'var(--tx3)' }} data-tip={sbCollapsed ? 'Install app' : undefined} aria-label="Install app" onClick={promptInstall}>
          <Smartphone size={15} /><span style={{ flex: 1, fontSize: 13 }}>Install App</span>
        </button>
      )}

      {supabaseEnabled && (
        user ? (
          <div className="sb-profile" data-tip={sbCollapsed ? `${user.user_metadata?.full_name || user.email}${syncing ? ' · Syncing…' : ' · Synced'}` : undefined}>
            {user.user_metadata?.avatar_url
              ? <img className="sb-profile-av" src={user.user_metadata.avatar_url} alt="" />
              : <div className="sb-profile-av-fallback">{(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}</div>}
            <div className="sb-profile-info">
              <div className="sb-profile-name">{user.user_metadata?.full_name || 'Signed in'}</div>
              <div className="sb-profile-email">{user.email}</div>
            </div>
            <button type="button" className="sb-profile-sync" title={syncing ? 'Syncing…' : 'Synced — click to sign out'} aria-label="Sign out" onClick={onSignOut}>
              {syncing ? <Loader2 size={13} className="spin" style={{ color: 'var(--tx3)' }} /> : <LogOut size={13} style={{ color: 'var(--tx3)' }} />}
            </button>
          </div>
        ) : (
          <button type="button" className="anv" onClick={onGoogleSignIn} data-tip={sbCollapsed ? 'Sign in with Google' : undefined} aria-label="Sign in with Google" disabled={authBusy}>
            {authBusy ? <Loader2 size={15} className="spin" /> : <Globe size={15} />}
            <span style={{ flex: 1 }}>{authBusy ? 'Signing in…' : 'Sign in with Google'}</span>
          </button>
        )
      )}
      {syncErr && !sbCollapsed && (
        <p style={{ fontSize: 10.5, color: 'var(--re)', padding: '2px 10px 4px', lineHeight: 1.4 }}>{syncErr}</p>
      )}

      {onBack && (
        <button type="button" className="anv" style={{ color: 'var(--tx3)' }} onClick={onBack} data-tip={sbCollapsed ? 'Back to Site' : undefined} aria-label="Back to Site">
          <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
          <span style={{ flex: 1, fontSize: 13 }}>Back to Site</span>
        </button>
      )}
      <button type="button" className="anv" style={{ color: 'var(--tx3)' }} data-tip={sbCollapsed ? 'Lock Vault' : undefined} aria-label="Lock Vault" onClick={onLock}>
        <Lock size={15} /><span style={{ flex: 1, fontSize: 13 }}>Lock Vault</span>
      </button>
    </aside>
  );
}
