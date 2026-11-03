import React from 'react';
import { BarChart2, ShieldAlert } from 'lucide-react';
import { ClientNodeState } from '../types';

interface SimilarityChartProps {
  clients: ClientNodeState[];
  currentRound?: number;
  threshold?: number;
}

export const SimilarityChart: React.FC<SimilarityChartProps> = ({ clients, currentRound }) => {
  const isWarmup = !currentRound || currentRound <= 2;
  const realCutoff = isWarmup ? -0.10 : 0.00;
  const cutoffLabel = isWarmup ? 'Cutoff: -0.10 (Warm-up)' : 'Cutoff: 0.00';
  const markerPct = Math.max(0, Math.min(100, ((realCutoff + 0.5) / 1.5) * 100));

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
            Model Update Similarity
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Compares each hospital's update direction against group consensus. Inverted updates are rejected.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--purple-accent)' }}>
            <ShieldAlert size={12} color="var(--purple-accent)" /> Compromised (set by the demo setup)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '2px', background: '#ef4444' }} />
            <span>{cutoffLabel}</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {clients.map((c) => {
          // Normalize similarity: cosine range [-1.0 .. 1.0] -> bar width % [0 .. 100]
          // Map -0.5 to 0% and 1.0 to 100%
          const sim = c.similarity;
          const clampedSim = Math.max(-0.5, Math.min(1.0, sim));
          const pct = Math.max(0, Math.min(100, ((clampedSim + 0.5) / 1.5) * 100));

          const isExcluded = c.status === 'EXCLUDED';
          const isRejected = c.status === 'REJECTED' || c.status === 'FLAGGED';
          const isAccepted = c.status === 'ACCEPTED';
          const barColor = isExcluded
            ? 'var(--orange-accent, #f97316)'
            : isRejected
            ? '#ef4444'
            : isAccepted
            ? '#10b981'
            : '#64748b';

          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px 75px', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</span>
                {c.isMalicious && (
                  <span
                    className="badge badge-purple"
                    title="Compromised (set by the demo setup)"
                    style={{ fontSize: '0.575rem', padding: '0.1rem 0.35rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                  >
                    <ShieldAlert size={9} color="var(--purple-accent)" />
                    Compromised
                  </span>
                )}
              </div>

              {/* Progress bar with threshold guide */}
              <div style={{ position: 'relative', width: '100%', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Real Threshold Marker */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${markerPct}%`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'rgba(239, 68, 68, 0.7)',
                    zIndex: 2,
                  }}
                />
                {/* Value bar */}
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                    boxShadow: isExcluded ? '0 0 10px rgba(249,115,22,0.5)' : isRejected ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
                  }}
                />
              </div>

              {/* Similarity score */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textAlign: 'right', color: barColor, fontWeight: 600 }}>
                {sim.toFixed(4)}
              </div>

              {/* Verdict badge */}
              <div style={{ textAlign: 'right' }}>
                <span
                  className={isExcluded ? 'badge badge-orange' : isRejected ? 'badge badge-red' : isAccepted ? 'badge badge-green' : 'badge'}
                  style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem' }}
                >
                  {c.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
