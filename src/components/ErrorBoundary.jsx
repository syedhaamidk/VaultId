import { Component } from 'react';

/**
 * ErrorBoundary — last line of defence against the blank page.
 *
 * Without this, ANY render/effect error anywhere in the tree unmounts the
 * entire app and the user stares at an empty grid (body background only).
 * With it, the user gets a fallback with a reload action, and the error is
 * surfaced in the console for diagnosis.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep it visible in prod consoles for bug reports.
    console.error('[VaultID] Uncaught render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      const { fallbackTitle = 'Something went wrong' } = this.props;
      return (
        <div
          style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#07070F', color: '#EEEEFF', padding: 24, textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{fallbackTitle}</h1>
            <p style={{ fontSize: 14, color: '#AAAACC', lineHeight: 1.6, margin: '0 0 20px' }}>
              The page hit an unexpected error. Your encrypted vault data is safe —
              reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg,#7B6FE8,#C060F0)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '12px 28px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
