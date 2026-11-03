import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';

interface EventItem {
  timestamp: string;
  type: string;
  data: any;
}

interface EventStreamProps {
  events: EventItem[];
}

export const EventStream: React.FC<EventStreamProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getEventBadge = (type: string) => {
    switch (type) {
      // Backend canonical names
      case 'round_started':
      case 'round_start':
        return <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>ROUND START</span>;
      case 'global_model_broadcast':
        return <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>BROADCAST</span>;
      case 'client_training':
        return <span className="badge" style={{ fontSize: '0.6rem', background: 'rgba(59,130,246,0.25)', color: '#93c5fd', border: '1px solid #3b82f6' }}>TRAINING</span>;
      case 'client_update_sent':
        return <span className="badge" style={{ fontSize: '0.6rem', background: 'rgba(99,102,241,0.25)', color: '#c7d2fe', border: '1px solid #6366f1' }}>UPDATE SENT</span>;
      case 'detection_complete':
        return <span className="badge badge-amber" style={{ fontSize: '0.6rem' }}>DETECTION</span>;
      case 'aggregation_complete':
      case 'aggregate':
        return <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>FEDAVG</span>;
      case 'ledger_written':
      case 'chain_write':
        return <span className="badge badge-purple" style={{ fontSize: '0.6rem' }}>BLOCKCHAIN</span>;
      case 'round_completed':
      case 'round_end':
        return <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>ROUND END</span>;
      case 'run_completed':
      case 'run_end':
        return <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>RUN COMPLETE</span>;
      // Legacy
      case 'flag':
        return <span className="badge badge-amber" style={{ fontSize: '0.6rem' }}>FLAGGED</span>;
      case 'exclude':
        return <span className="badge badge-red" style={{ fontSize: '0.6rem' }}>EXCLUDED</span>;
      case 'metrics':
        return <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>EVAL METRICS</span>;
      case 'error':
        return <span className="badge badge-red" style={{ fontSize: '0.6rem' }}>ERROR</span>;
      default:
        return <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{type}</span>;
    }
  };

  const formatEventMessage = (event: EventItem) => {
    const { type, data } = event;
    try {
      switch (type) {
        // Backend canonical names
        case 'round_started':
        case 'round_start':
          return `Round ${data.round}/${data.total_rounds} — ${(data.scenario ?? 'demo').toUpperCase()} profile active`;

        case 'global_model_broadcast':
          return `Server broadcasts global model to all ${data.message ?? 'hospitals'}`;

        case 'client_training':
          return `${data.hospital_id ?? `H${(data.client_id ?? 0) + 1}`} training on private X-rays...`;

        case 'client_update_sent':
          return `${data.hospital_id ?? `H${(data.client_id ?? 0) + 1}`} sent model update to server`;

        case 'detection_complete': {
          const recs = Object.values(data.records_by_client ?? data.records ?? {}) as any[];
          const rejected = recs.filter((r: any) => r.status === 'Rejected').length;
          const excluded = recs.filter((r: any) => r.status === 'Excluded').length;
          const accepted = recs.filter((r: any) => r.status === 'Accepted').length;
          return `Detection: ${accepted} accepted, ${rejected} rejected, ${excluded} excluded`;
        }

        case 'aggregation_complete':
          return `FedAvg: ${data.trusted_count ?? '?'} trusted updates — Acc ${((data.accuracy ?? 0) * 100).toFixed(1)}% Loss ${(data.loss ?? 0).toFixed(4)}`;

        case 'ledger_written':
          return `Ledger: ${data.entries_count ?? 0} block(s) written [mode: ${data.mode ?? 'mock'}]`;

        case 'round_completed':
        case 'round_end': {
          const rec = data.record ?? data ?? {};
          return `Round ${rec.round ?? data.round} ✓  Acc ${((rec.accuracy ?? 0) * 100).toFixed(1)}%  Loss ${(rec.loss ?? 0).toFixed(4)}  Chain ${rec.blockchain_ms ?? 0}ms`;
        }

        case 'run_completed':
        case 'run_end':
          return `Simulation complete — Final Acc ${((data.final_accuracy ?? 0) * 100).toFixed(1)}%  Elapsed ${data.elapsed_seconds ?? '?'}s`;

        // Legacy
        case 'flag':
          return `Hospital #${data.client_id} flagged: ${data.reason ?? ''}`;
        case 'exclude':
          return `Hospital #${data.client_id} excluded from aggregation: ${data.reason ?? ''}`;
        case 'aggregate':
          return `FedAvg aggregated ${data.trusted_count} trusted updates (${data.excluded_count} quarantined)`;
        case 'metrics':
          return `Global Eval: Acc ${((data.metrics?.accuracy ?? data.accuracy ?? 0) * 100).toFixed(1)}% | Loss ${(data.metrics?.loss ?? data.loss ?? 0).toFixed(4)} | F1 ${((data.metrics?.f1 ?? data.f1 ?? 0) * 100).toFixed(1)}%`;
        case 'chain_write':
          return `Block #${data.entry?.index} mined [Client ${data.entry?.client_id} → ${data.entry?.status}] hash: ${(data.entry?.fingerprint ?? data.entry?.update_hash ?? '').slice(0, 10)}...`;
        case 'error':
          return `Error: ${data.message ?? JSON.stringify(data)}`;
        default:
          return JSON.stringify(data).slice(0, 120);
      }
    } catch {
      return JSON.stringify(data).slice(0, 120);
    }
  };

  const getRowColor = (type: string) => {
    if (type === 'error') return 'rgba(239,68,68,0.08)';
    if (type === 'detection_complete' || type === 'flag') return 'rgba(245,158,11,0.06)';
    if (type === 'exclude') return 'rgba(239,68,68,0.06)';
    if (type === 'aggregation_complete' || type === 'aggregate') return 'rgba(6,182,212,0.06)';
    if (type === 'ledger_written' || type === 'chain_write') return 'rgba(139,92,246,0.06)';
    if (type === 'run_completed' || type === 'run_end') return 'rgba(16,185,129,0.08)';
    return 'transparent';
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Terminal size={16} color="var(--cyan-bright)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Live Security Audit &amp; Event Stream
          </h3>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {events.length} events logged
        </span>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: '220px',
          maxHeight: '340px',
          overflowY: 'auto',
          background: 'rgba(9, 14, 24, 0.85)',
          borderRadius: '8px',
          padding: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
            Awaiting simulation start... Start a run to observe live event telemetry.
          </div>
        ) : (
          events.slice(-80).map((e, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                lineHeight: '1.4',
                padding: '0.15rem 0.3rem',
                borderRadius: '4px',
                background: getRowColor(e.type),
              }}
            >
              <span style={{ color: '#475569', fontSize: '0.675rem', whiteSpace: 'nowrap', paddingTop: '0.05rem' }}>
                {e.timestamp}
              </span>
              <div style={{ flexShrink: 0 }}>
                {getEventBadge(e.type)}
              </div>
              <span style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>
                {formatEventMessage(e)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
