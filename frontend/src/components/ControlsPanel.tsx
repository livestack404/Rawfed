import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  StepForward,
  ShieldCheck, 
  ShieldAlert, 
  Shield
} from 'lucide-react';
import { RunConfig, ScenarioType, AttackType } from '../types';

interface ControlsPanelProps {
  config: RunConfig;
  onChangeConfig: (newCfg: RunConfig) => void;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onStep: () => void;
  onReset: () => void;
  currentRound: number;
  totalRounds: number;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  config,
  onChangeConfig,
  isRunning,
  isPaused,
  onStart,
  onTogglePause,
  onStep,
  onReset,
  currentRound,
  totalRounds,
}) => {
  const setScenario = (sc: ScenarioType) => {
    let malicious = [3, 7];
    let detection = true;
    let attackType: AttackType = 'label_flip';

    if (sc === 'clean') {
      malicious = [];
      detection = false;
    } else if (sc === 'attacked') {
      malicious = [3, 7];
      detection = false;
    } else if (sc === 'defended') {
      malicious = [3, 7];
      detection = true;
    }

    onChangeConfig({
      ...config,
      scenario: sc,
      malicious_ids: malicious,
      detection,
      attack_type: attackType,
      rounds: 10,
    });
  };

  const scenarios: { id: ScenarioType; label: string; sub: string; icon: any; color: string }[] = [
    {
      id: 'clean',
      label: 'Normal',
      sub: 'All 8 hospitals honest & uncompromised',
      icon: Shield,
      color: '#10b981',
    },
    {
      id: 'attacked',
      label: 'Under attack, no protection',
      sub: 'H4 & H8 poison updates with defense disabled',
      icon: ShieldAlert,
      color: '#ef4444',
    },
    {
      id: 'defended',
      label: 'Under attack, with protection',
      sub: 'Cosine MAD detector & persistence exclusion active',
      icon: ShieldCheck,
      color: 'var(--cyan-bright)',
    },
  ];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      {/* Top Header: Title & Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>
              FL Simulation Controls
            </h3>
            <span
              className="badge"
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--cyan-bright)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                fontSize: '0.675rem',
              }}
            >
              Demo: 10 rounds, small images, for speed
            </span>
          </div>
          <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Hospitals train one shared model without sharing patient X-rays. Only what the model learned travels, never the images.
          </p>
        </div>

        {/* Action Controls: Start, Pause/Resume toggle, Step, Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!isRunning ? (
            <button className="btn-primary" onClick={onStart}>
              <Play size={15} fill="currentColor" />
              <span>Start</span>
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={onTogglePause}
              style={{ background: isPaused ? '#10b981' : undefined }}
            >
              {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={onStep}
            disabled={!isRunning || !isPaused}
            title={isRunning && isPaused ? 'Step one phase forward' : 'Pause first to step one phase at a time'}
          >
            <StepForward size={15} />
            <span>Step</span>
          </button>

          <button className="btn-secondary" onClick={onReset} disabled={isRunning && !isPaused}>
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <div
            style={{
              padding: '0.45rem 0.8rem',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            Round <strong style={{ color: '#ffffff' }}>{currentRound}</strong> / {totalRounds || 10}
          </div>
        </div>
      </div>

      {/* Scenario Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {scenarios.map((sc) => {
          const isSelected = config.scenario === sc.id;
          const Icon = sc.icon;
          return (
            <div
              key={sc.id}
              onClick={() => !isRunning && setScenario(sc.id)}
              style={{
                padding: '0.9rem',
                borderRadius: '10px',
                border: isSelected ? `1.5px solid ${sc.color}` : '1px solid var(--border-subtle)',
                background: isSelected ? `${sc.color}18` : 'var(--bg-secondary)',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 15px -3px ${sc.color}40` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.85rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                  <Icon size={17} color={sc.color} />
                  {sc.label}
                </span>
                {sc.id === 'defended' && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.55rem' }}>RECOMMENDED</span>
                )}
              </div>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                {sc.sub}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
