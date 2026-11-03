import React from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ClientNodeState } from '../types';

interface VerdictRecord {
  hospital_id?: string;
  client_id?: number;
  status: string;
  reason_text?: string;
  reason?: string;
  cosine_similarity?: number;
  similarity?: number;
  trust_after?: number;
  trust_before?: number;
  robust_z?: number;
}

interface CheckTableProps {
  clients: ClientNodeState[];
  currentStep: number;
  verdicts: Record<number, VerdictRecord> | null;
}

export const CheckTable: React.FC<CheckTableProps> = ({
  clients,
  currentStep,
  verdicts,
}) => {
  const isChecked = currentStep >= 4 && verdicts !== null && Object.keys(verdicts).length > 0;

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACCEPTED') {
      return <span className="badge badge-green">ACCEPTED</span>;
    }
    if (s === 'EXCLUDED') {
      return <span className="badge badge-orange">EXCLUDED</span>;
    }
    if (s === 'REJECTED') {
      return <span className="badge badge-red">REJECTED</span>;
    }
    if (s === 'FLAGGED') {
      return <span className="badge badge-amber">FLAGGED</span>;
    }
    return <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{status}</span>;
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--cyan-bright)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
              Hospital Update Anomaly Verification Table
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Evaluates incoming hospital updates against group consensus to detect and exclude poisoned updates.
          </p>
        </div>
        {!isChecked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--amber-accent)' }}>
            <AlertTriangle size={14} />
            <span>Updates are checked at step 4 of each round.</span>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.725rem' }}>
              <th style={{ padding: '0.6rem 0.75rem' }}>HOSPITAL</th>
              <th style={{ padding: '0.6rem 0.75rem' }}>STATUS</th>
              <th style={{ padding: '0.6rem 0.75rem' }}>SIMILARITY</th>
              <th style={{ padding: '0.6rem 0.75rem' }}>TRUST SCORE</th>
              <th style={{ padding: '0.6rem 0.75rem' }}>VERDICT REASON</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const v = verdicts ? (verdicts[c.id] ?? (verdicts as any)[String(c.id)]) : null;
              const status = isChecked && v ? v.status : (c.status || 'Idle');
              const reason = isChecked && v ? (v.reason_text || v.reason || 'Normal weight delta') : 'Pending evaluation at Step 4';
              const sim = isChecked && v && v.cosine_similarity !== undefined
                ? v.cosine_similarity
                : (isChecked && v && v.similarity !== undefined ? v.similarity : (c.similarity ?? 1.0));
              const trust = isChecked && v && v.trust_after !== undefined ? v.trust_after : 100;

              return (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: c.isMalicious ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                  }}
                >
                  {/* Hospital Label + Purple Marker */}
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{c.name}</span>
                      {c.isMalicious && (
                        <span
                          className="badge badge-purple"
                          title="Compromised (set by the demo setup)"
                          style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <ShieldAlert size={10} color="var(--purple-accent)" />
                          Compromised
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    {isChecked ? getStatusBadge(status) : <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>PENDING</span>}
                  </td>

                  {/* Similarity */}
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {isChecked ? (
                      <span style={{ color: (status === 'REJECTED' || status === 'EXCLUDED' || sim < 0.0) ? '#f87171' : 'var(--cyan-bright)', fontWeight: 600 }}>
                        {sim.toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>

                  {/* Trust Score + Thin Visual Bar */}
                  <td style={{ padding: '0.65rem 0.75rem', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', width: '28px', color: trust < 70 ? '#f87171' : '#34d399' }}>
                        {trust}
                      </span>
                      <div style={{ flex: 1, height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, trust))}%`,
                            height: '100%',
                            background: trust < 50 ? 'var(--orange-accent, #f97316)' : trust < 80 ? 'var(--amber-accent)' : 'var(--emerald-accent)',
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Verdict Reason */}
                  <td style={{ padding: '0.65rem 0.75rem', color: isChecked && status !== 'ACCEPTED' ? '#fcd34d' : 'var(--text-secondary)', fontSize: '0.775rem' }}>
                    {reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
