import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type BoundaryState = { hasError: boolean };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostics available without exposing technical details to users.
    console.error('[ROCKCRAFT] Application render failed:', error, info.componentStack);
  }

  private recover = () => {
    // A full reload also refreshes cached application assets.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7fc', fontFamily: 'system-ui, sans-serif' }}>
          <section role="alert" style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 12px 36px rgba(15,23,42,.08)', textAlign: 'center', boxSizing: 'border-box' }}>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: 28, fontWeight: 900 }}>ROCKCRAFT</h1>
            <h2 style={{ margin: '22px 0 8px', color: '#0f172a', fontSize: 18 }}>The page could not load</h2>
            <p style={{ margin: '0 0 22px', color: '#475569', lineHeight: 1.6 }}>Your work has not been intentionally deleted. Reload the page to try again. If this keeps happening, check your internet connection and contact support.</p>
            <button onClick={this.recover} style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 12, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Reload ROCKCRAFT</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
} else {
  document.body.innerHTML = '<main style="font-family:system-ui;padding:32px;text-align:center"><h1>ROCKCRAFT</h1><p>The app could not start. Please reload this page.</p><button onclick="location.reload()">Reload</button></main>';
}
