import React from 'react';
import { Target, TrendingUp, ShieldCheck, CheckCircle2, XCircle, Database, Zap } from 'lucide-react';
import { RoundMetrics } from '../types';

interface LiveMetricsCardsProps {
  metrics: RoundMetrics | null;
  totalClients: number;
}

export const LiveMetricsCards: React.FC<LiveMetricsCardsProps> = ({ metrics, totalClients }) => {
  const acc = metrics ? (metrics.accuracy * 100).toFixed(1) : '0.0';
  const loss = metrics ? metrics.loss.toFixed(4) : '0.0000';
  const f1 = metrics ? (metrics.f1 * 100).toFixed(1) : '0.0';
  const precision = metrics ? (metrics.precision * 100).toFixed(1) : '0.0';
  const recall = metrics ? (metrics.recall * 100).toFixed(1) : '0.0';
  const trusted = metrics ? metrics.trusted_clients : totalClients;
  const excluded = metrics ? metrics.excluded_clients : 0;
  const chainMs = metrics ? metrics.blockchain_ms.toFixed(1) : '0.0';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: '0.75rem',
      marginBottom: '1rem',
    }}>
      {/* Accuracy Card */}
      <div className="glass-panel" style={{ padding: '0.9rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Validation Accuracy
          </span>
          <Target size={16} color="var(--cyan-bright)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#ffffff',
          }}>
            {acc}%
          </span>
          <span style={{ fontSize: '0.7rem', color: '#34d399' }}>validation set</span>
        </div>
        <div style={{ marginTop: '0.35rem', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${acc}%`, height: '100%', background: 'var(--cyan-primary)' }} />
        </div>
      </div>

      {/* Loss Card */}
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cross-Entropy Loss
          </span>
          <TrendingUp size={16} color="#a78bfa" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#ffffff',
          }}>
            {loss}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>validation set</span>
      </div>

      {/* F1 Score Card */}
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            F1-Score / Recall
          </span>
          <ShieldCheck size={16} color="#34d399" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
          }}>
            {f1}%
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            rec: {recall}%
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          prec: {precision}%
        </span>
      </div>

      {/* Node Consensus Health */}
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Node Consensus
          </span>
          <CheckCircle2 size={16} color="#10b981" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#34d399',
          }}>
            {trusted}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ {totalClients} trusted</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: excluded > 0 ? '#f87171' : 'var(--text-muted)' }}>
          {excluded > 0 && <XCircle size={12} color="#ef4444" />}
          <span>{excluded} poisoned updates excluded</span>
        </div>
      </div>

      {/* Blockchain Latency Card */}
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Audit Write Time
          </span>
          <Database size={16} color="#38bdf8" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#ffffff',
          }}>
            {chainMs}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ms / round</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          8 tamper-evident blocks/round
        </span>
      </div>
    </div>
  );
};
