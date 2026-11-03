import React, { useEffect, useRef, useState } from 'react';
import { Terminal, ChevronDown, ChevronRight } from 'lucide-react';

export interface RoundLogData {
  round: number;
  step1?: string;
  step2Lines: string[];
  step3Lines: string[];
  step4Lines: string[];
  step5?: string;
  step6?: string;
  summary?: string;
}

interface RoundLogProps {
  logs: RoundLogData[];
  currentRound: number;
}

export const RoundLog: React.FC<RoundLogProps> = ({ logs, currentRound }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleRound = (round: number) => {
    setCollapsedRounds((prev) => ({
      ...prev,
      [round]: !prev[round],
    }));
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={16} color="var(--cyan-bright)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
            Round Log Telemetry
          </h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Monospace execution trace • Real measured metrics
        </span>
      </div>

      <div
        ref={containerRef}
        style={{
          background: 'rgba(5, 8, 14, 0.95)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '1rem',
          maxHeight: '360px',
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.775rem',
          lineHeight: '1.6',
          color: '#cbd5e1',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Awaiting simulation start. Round log output will stream here in real time...
          </div>
        ) : (
          logs.map((rLog) => {
            const isCurrent = rLog.round === currentRound;
            const isCollapsed = collapsedRounds[rLog.round] !== undefined
              ? collapsedRounds[rLog.round]
              : !isCurrent;

            return (
              <div
                key={`round-log-${rLog.round}`}
                style={{
                  marginBottom: '0.75rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingBottom: '0.5rem',
                }}
              >
                {/* Header / Summary toggle bar */}
                <div
                  onClick={() => toggleRound(rLog.round)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: isCurrent ? 'var(--cyan-bright)' : '#94a3b8',
                    fontWeight: 600,
                  }}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span>
                    {isCollapsed && rLog.summary
                      ? rLog.summary
                      : `── Round ${rLog.round} ${isCurrent ? '(Active)' : 'Execution Trace'} ──`}
                  </span>
                </div>

                {/* Expanded steps */}
                {!isCollapsed && (
                  <div style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {/* Step 1 */}
                    {rLog.step1 && (
                      <div style={{ color: '#67e8f9' }}>
                        <span style={{ color: '#06b6d4' }}>Step 1</span>  {rLog.step1}
                      </div>
                    )}

                    {/* Step 2 */}
                    {rLog.step2Lines.map((line, idx) => (
                      <div key={`s2-${idx}`} style={{ color: '#cbd5e1' }}>
                        <span style={{ color: '#06b6d4' }}>Step 2</span>  {line}
                      </div>
                    ))}

                    {/* Step 3 */}
                    {rLog.step3Lines.map((line, idx) => (
                      <div key={`s3-${idx}`} style={{ color: '#93c5fd' }}>
                        <span style={{ color: '#06b6d4' }}>Step 3</span>  {line}
                      </div>
                    ))}

                    {/* Step 4 */}
                    {rLog.step4Lines.map((line, idx) => (
                      <div
                        key={`s4-${idx}`}
                        style={{
                          color: line.includes('REJECTED') || line.includes('EXCLUDED') ? '#fca5a5' : '#86efac',
                        }}
                      >
                        <span style={{ color: '#06b6d4' }}>Step 4</span>  {line}
                      </div>
                    ))}

                    {/* Step 5 */}
                    {rLog.step5 && (
                      <div style={{ color: '#fef08a' }}>
                        <span style={{ color: '#06b6d4' }}>Step 5</span>  {rLog.step5}
                      </div>
                    )}

                    {/* Step 6 */}
                    {rLog.step6 && (
                      <div style={{ color: '#c084fc' }}>
                        <span style={{ color: '#06b6d4' }}>Step 6</span>  {rLog.step6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
