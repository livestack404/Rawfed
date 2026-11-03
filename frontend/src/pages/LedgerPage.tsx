import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  Check,
  ArchiveRestore,
  Fingerprint,
} from 'lucide-react';
import { VerificationResult } from '../types';

// ─── Real record shape from backend/app/blockchain/local_records.json ──────────
interface LedgerRecord {
  index: number;
  run_id?: string;
  round: number;
  hospital_id: string;
  client_id: number;
  /** "Accepted" | "Rejected" | "Excluded" */
  status: string;
  reason_text: string;
  cosine_similarity: number;
  robust_z: number;
  norm_ratio?: number;
  trust_before: number;
  trust_after: number;
  update_hash: string;
  fingerprint: string;
  // optional block-chain fields present in ganache/hash-chain mode
  block_hash?: string;
  prev_hash?: string;
  timestamp?: number;
}

const statusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'excluded') return 'badge badge-red';
  if (s === 'rejected') return 'badge badge-amber';
  return 'badge badge-green';
};

const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'excluded') return '#ef4444';
  if (s === 'rejected') return '#f59e0b';
  return '#10b981';
};

export const LedgerPage: React.FC = () => {
  const [entries, setEntries] = useState<LedgerRecord[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [mode, setMode] = useState<string>('mock');
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/ledger');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Backend may return records under "entries" or "records"
      const raw: any[] = data.entries ?? data.records ?? [];
      setEntries(raw as LedgerRecord[]);
      setMode(data.mode ?? 'mock');
    } catch (err: any) {
      setError(`Failed to load ledger: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleVerifyIntegrity = async () => {
    setIsLoading(true);
    setTamperMessage(null);
    try {
      const res = await fetch('/api/ledger/verify');
      const data = await res.json();
      setVerification(data);
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTamperDemonstration = async () => {
    if (entries.length === 0) return;
    setIsLoading(true);
    try {
      const targetIndex = Math.max(0, Math.floor(entries.length / 2));
      const res = await fetch(`/api/ledger/tamper?index=${targetIndex}`, { method: 'POST' });
      const data = await res.json();
      setTamperMessage(data.message);
      await fetchLedger();
      setVerification(null);
    } catch (err) {
      console.error('Tamper attempt failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Restore the ledger from its last clean backup?')) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/ledger/restore', { method: 'POST' });
      if (res.ok) {
        await fetchLedger();
        setVerification(null);
        setTamperMessage(null);
      } else {
        const d = await res.json();
        alert(d.detail ?? 'Restore failed');
      }
    } catch (err) {
      console.error('Restore failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      e.round.toString().includes(t) ||
      String(e.hospital_id).toLowerCase().includes(t) ||
      e.status.toLowerCase().includes(t) ||
      (e.fingerprint ?? '').toLowerCase().includes(t) ||
      (e.update_hash ?? '').toLowerCase().includes(t) ||
      e.reason_text.toLowerCase().includes(t)
    );
  });

  return (
    <div
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '1.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={24} color="var(--cyan-bright)" />
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1.5rem',
                color: '#ffffff',
              }}
            >
              Immutable Blockchain Audit Ledger
            </h2>
            <span
              className={mode === 'ganache' ? 'badge badge-green' : 'badge badge-purple'}
            >
              {mode === 'ganache' ? 'Ganache Blockchain' : 'Local Hash-Chain'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Cryptographically sealed audit trail — model-update hashes, cosine consensus
            scores, and exclusion verdicts per hospital per round.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={handleVerifyIntegrity}
            disabled={isLoading || entries.length === 0}
          >
            <ShieldCheck size={16} />
            <span>Verify Integrity</span>
          </button>

          <button
            className="btn-danger"
            onClick={handleTamperDemonstration}
            disabled={isLoading || entries.length === 0}
            title="Simulates an adversary forcibly modifying a past ledger record on disk"
          >
            <AlertTriangle size={16} />
            <span>Tamper Past Block (Demo)</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleRestore}
            disabled={isLoading}
            title="Restore ledger from last clean backup"
          >
            <ArchiveRestore size={15} />
            <span>Restore</span>
          </button>

          <button className="btn-secondary" onClick={fetchLedger} disabled={isLoading}>
            <RotateCcw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.12)',
            border: '1.5px solid #ef4444',
            color: '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertTriangle size={18} color="#ef4444" />
          {error}
        </div>
      )}

      {/* ── Tamper Notification Banner ────────────────────────────────── */}
      {tamperMessage && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1.5px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span>{tamperMessage}</span>
          </div>
          <button
            className="btn-primary"
            onClick={handleVerifyIntegrity}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
          >
            Run Integrity Check Now
          </button>
        </div>
      )}

      {/* ── Verification Result Banner ────────────────────────────────── */}
      {verification && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: verification.valid
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `1.5px solid ${verification.valid ? '#10b981' : '#ef4444'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {verification.valid ? (
              <CheckCircle2 size={24} color="#10b981" />
            ) : (
              <XCircle size={24} color="#ef4444" />
            )}
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: verification.valid ? '#34d399' : '#f87171',
              }}
            >
              {verification.valid
                ? 'Cryptographic Integrity Verified'
                : 'Cryptographic Chain Severance Detected!'}
            </h3>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#f8fafc', margin: 0 }}>
            {verification.message ?? verification.reason}
          </p>

          {!verification.valid && (
            (() => {
              const mismatch = verification.mismatches?.[0];
              const tamperedIndex = mismatch?.index ?? verification.tampered_index ?? 0;
              const reason = mismatch?.reason ?? verification.reason ?? 'Local record does not match blockchain';
              const expectedHash = mismatch?.expected_blockchain_fingerprint ?? verification.expected_block_hash;
              const actualHash = mismatch?.actual_local_fingerprint ?? verification.actual_block_hash;

              return (
                <div
                  style={{
                    background: 'rgba(9, 14, 24, 0.9)',
                    padding: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div>
                    Tampered Block Index:{' '}
                    <strong style={{ color: '#ef4444' }}>#{tamperedIndex}</strong>
                  </div>
                  <div>
                    Violation Type:{' '}
                    <strong style={{ color: '#f59e0b' }}>{reason}</strong>
                  </div>
                  {expectedHash && (
                    <div style={{ wordBreak: 'break-all' }}>
                      Expected Fingerprint:{' '}
                      <span style={{ color: '#10b981' }}>{expectedHash}</span>
                    </div>
                  )}
                  {actualHash && (
                    <div style={{ wordBreak: 'break-all' }}>
                      Actual Local Fingerprint:{' '}
                      <span style={{ color: '#ef4444' }}>{actualHash}</span>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {verification.valid && verification.latest_block_hash && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Latest Verified Hash:{' '}
              <span style={{ color: '#67e8f9' }}>{verification.latest_block_hash}</span>{' '}
              ({verification.total_entries} blocks validated)
            </div>
          )}
        </div>
      )}

      {/* ── Audit Table ───────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ position: 'relative', width: '300px' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '10px' }}
            />
            <input
              type="text"
              placeholder="Search round, hospital, verdict, hash…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem 0.45rem 2.2rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.8rem',
              }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing {filteredEntries.length} of {entries.length} audit records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.75rem 0.6rem' }}>#</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Round</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Hospital</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Verdict</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Cosine Sim</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Robust Z</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Trust Δ</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Reason</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Fingerprint</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}
                  >
                    {entries.length === 0
                      ? 'No audit records found. Run a simulation to log federated updates.'
                      : 'No records match your search.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e, i) => {
                  const col = statusColor(e.status);
                  const trustDelta = (e.trust_after ?? 0) - (e.trust_before ?? 0);
                  const fp = e.fingerprint ?? '';
                  const hash = e.update_hash ?? '';
                  return (
                    <tr
                      key={`${e.round}-${e.hospital_id}-${i}`}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(ev) =>
                        (ev.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')
                      }
                      onMouseLeave={(ev) =>
                        (ev.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      {/* Index */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: 'var(--cyan-bright)',
                        }}
                      >
                        #{e.index ?? i}
                      </td>

                      {/* Round */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontWeight: 600,
                          color: '#ffffff',
                        }}
                      >
                        R{e.round}
                      </td>

                      {/* Hospital */}
                      <td style={{ padding: '0.75rem 0.6rem' }}>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                          {e.hospital_id}
                        </span>
                      </td>

                      {/* Verdict */}
                      <td style={{ padding: '0.75rem 0.6rem' }}>
                        <span className={statusBadge(e.status)}>{e.status}</span>
                      </td>

                      {/* Cosine Similarity */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: col,
                        }}
                      >
                        {(e.cosine_similarity ?? 0).toFixed(4)}
                      </td>

                      {/* Robust Z */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          color: Math.abs(e.robust_z ?? 0) > 2.5 ? '#f59e0b' : '#94a3b8',
                        }}
                      >
                        {(e.robust_z ?? 0).toFixed(2)}σ
                      </td>

                      {/* Trust Δ */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          color:
                            trustDelta < 0
                              ? '#ef4444'
                              : trustDelta > 0
                              ? '#10b981'
                              : '#64748b',
                        }}
                      >
                        {e.trust_before ?? '—'} → {e.trust_after ?? '—'}
                      </td>

                      {/* Reason */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          color: 'var(--text-secondary)',
                          maxWidth: '180px',
                          fontSize: '0.75rem',
                        }}
                      >
                        <span title={e.reason_text}>
                          {e.reason_text.length > 38
                            ? e.reason_text.slice(0, 38) + '…'
                            : e.reason_text}
                        </span>
                      </td>

                      {/* Fingerprint */}
                      <td
                        style={{
                          padding: '0.75rem 0.6rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#94a3b8',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Fingerprint size={12} color="#67e8f9" />
                          <span title={fp}>{fp ? `${fp.slice(0, 8)}…` : '—'}</span>
                          {fp && (
                            <button
                              onClick={() => copyToClipboard(fp)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                padding: 0,
                              }}
                              title="Copy fingerprint"
                            >
                              {copied === fp ? (
                                <Check size={12} color="#10b981" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {[
            {
              label: 'Total Records',
              value: entries.length,
              color: 'var(--cyan-bright)',
            },
            {
              label: 'Accepted',
              value: entries.filter((e) => e.status.toLowerCase() === 'accepted').length,
              color: '#10b981',
            },
            {
              label: 'Rejected',
              value: entries.filter((e) => e.status.toLowerCase() === 'rejected').length,
              color: '#f59e0b',
            },
            {
              label: 'Excluded',
              value: entries.filter((e) => e.status.toLowerCase() === 'excluded').length,
              color: '#ef4444',
            },
            {
              label: 'Avg Cosine Sim',
              value: (
                entries.reduce((s, e) => s + (e.cosine_similarity ?? 0), 0) / entries.length
              ).toFixed(3),
              color: '#a78bfa',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="glass-panel"
              style={{ padding: '0.9rem', textAlign: 'center' }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.35rem',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
