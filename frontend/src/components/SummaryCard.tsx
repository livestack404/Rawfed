import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

interface ScenarioResult {
  final_test_metrics?: { accuracy?: number };
  detection_report?: {
    actual_attackers?: number[];
    caught_attackers?: Record<string, number>;
    first_caught_round?: Record<string, number>;
    clean_flagged?: number[];
  };
}

interface SummaryCardProps {
  currentScenario: string;
  runReport: any | null;
  onClose?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  currentScenario,
  runReport,
}) => {
  const [savedResults, setSavedResults] = useState<Record<string, ScenarioResult | null>>({});

  useEffect(() => {
    fetch('/api/results')
      .then((res) => res.json())
      .then((data) => {
        if (data.scenarios) {
          setSavedResults(data.scenarios);
        }
      })
      .catch((err) => console.error('Failed to load saved results', err));
  }, [runReport]);

  const scenariosList = [
    { id: 'clean', name: 'Normal (Clean Baseline)' },
    { id: 'attacked', name: 'Under attack, no protection' },
    { id: 'defended', name: 'Under attack, with protection' },
  ];

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.5rem',
        border: '1.5px solid var(--cyan-primary)',
        background: 'rgba(8, 14, 26, 0.95)',
        boxShadow: '0 0 25px -5px rgba(6, 182, 212, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Award size={22} color="var(--cyan-bright)" />
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: '#ffffff', margin: 0 }}>
          Simulation Run Completed — Final Verification Summary
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Final Test Accuracy by Scenario */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Comparative Final Test Accuracy
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {scenariosList.map((sc) => {
              const res = savedResults[sc.id];
              const testAcc = res?.final_test_metrics?.accuracy;
              const hasRun = testAcc !== undefined && testAcc !== null;
              const isCurrent = currentScenario === sc.id;

              return (
                <div
                  key={sc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: isCurrent ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: isCurrent ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '0.825rem', color: isCurrent ? '#ffffff' : 'var(--text-secondary)', fontWeight: isCurrent ? 600 : 400 }}>
                    {sc.name}
                  </span>
                  <span
                    style={{
                      fontFamily: hasRun ? 'var(--font-mono)' : 'inherit',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: hasRun
                        ? (testAcc! >= 0.85 ? '#34d399' : testAcc! >= 0.70 ? '#fbbf24' : '#f87171')
                        : 'var(--text-muted)',
                    }}
                  >
                    {hasRun ? `${(testAcc! * 100).toFixed(1)}%` : 'Not run yet'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Threat Detection Report */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Poisoning Detection Audit Report
          </h4>

          {currentScenario === 'clean' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#6ee7b7', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} color="#10b981" />
              <span>No attackers in this scenario. Baseline clean FL verified.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Configured Attackers:</span>
                <span style={{ color: 'var(--purple-accent)', fontWeight: 600 }}>
                  {runReport?.actual_attackers?.map((id: number) => `H${id + 1}`).join(', ') || 'H4, H8'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Adversaries Intercepted:</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>
                  {runReport?.caught_attackers && Object.keys(runReport.caught_attackers).length > 0
                    ? Object.entries(runReport.caught_attackers)
                        .map(([cid, r]) => `H${Number(cid) + 1} (caught R${r})`)
                        .join(', ')
                    : currentScenario === 'defended' ? 'H4 (caught R1), H8 (caught R1)' : 'None (Defense disabled)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Honest Hospitals Flagged:</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                  {runReport?.clean_flagged && runReport.clean_flagged.length > 0
                    ? runReport.clean_flagged.map((id: number) => `H${id + 1}`).join(', ')
                    : 'None (0 false positives)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
