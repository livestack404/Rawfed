import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  label?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            maxWidth: '1440px',
            margin: '3rem auto',
            padding: '2rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={36} color="#ef4444" />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '1.25rem',
              color: '#f87171',
            }}
          >
            {this.props.label ?? 'Page'} crashed — one bug cannot blank the app
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '540px' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            className="btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
