import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { NetworkGraph } from '../components/NetworkGraph';
import { ControlsPanel } from '../components/ControlsPanel';
import { LiveMetricsCards } from '../components/LiveMetricsCards';
import { SimilarityChart } from '../components/SimilarityChart';
import { AccuracyChart } from '../components/AccuracyChart';
import { CheckTable } from '../components/CheckTable';
import { RoundLog, RoundLogData } from '../components/RoundLog';
import { SummaryCard } from '../components/SummaryCard';
import { EventStream } from '../components/EventStream';
import { ClientNodeState, RoundMetrics, RunConfig } from '../types';

interface DashboardProps {
  clients: ClientNodeState[];
  metrics: RoundMetrics | null;
  config: RunConfig;
  onChangeConfig: (newCfg: RunConfig) => void;
  isRunning: boolean;
  isPaused: boolean;
  currentStep: number;
  currentRound: number;
  totalRounds: number;
  accuracyHistory: { round: number; accuracy: number }[];
  verdicts: Record<number, any> | null;
  roundLogs: RoundLogData[];
  runReport: any | null;
  onStart: () => void;
  onTogglePause: () => void;
  onStep: () => void;
  onReset: () => void;
  events: any[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  clients,
  metrics,
  config,
  onChangeConfig,
  isRunning,
  isPaused,
  currentStep,
  currentRound,
  totalRounds,
  accuracyHistory,
  verdicts,
  roundLogs,
  runReport,
  onStart,
  onTogglePause,
  onStep,
  onReset,
  events,
}) => {
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [isEventStreamOpen, setIsEventStreamOpen] = useState(false);

  const isAttackScenario = config.scenario === 'attacked' || config.scenario === 'defended';

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Controls Panel */}
      <ControlsPanel
        config={config}
        onChangeConfig={onChangeConfig}
        isRunning={isRunning}
        isPaused={isPaused}
        onStart={onStart}
        onTogglePause={onTogglePause}
        onStep={onStep}
        onReset={onReset}
        currentRound={currentRound}
        totalRounds={totalRounds}
      />

      {/* 2. Attack Banner (Amber, in attack scenarios) */}
      {isAttackScenario && (
        <div
          className="glass-panel"
          style={{
            padding: '0.8rem 1.25rem',
            border: '1px solid #f59e0b',
            background: 'rgba(245, 158, 11, 0.08)',
            borderRadius: '10px',
            color: '#fcd34d',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            boxShadow: '0 0 15px -3px rgba(245, 158, 11, 0.15)',
          }}
        >
          <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
            2 hospitals are compromised (marked in purple). The system is not told which; it has to find them from their updates.
          </span>
        </div>
      )}

      {/* 3. Live Metrics Cards (Validation accuracy & loss) */}
      <LiveMetricsCards metrics={metrics} totalClients={clients.length} />

      {/* 4. Main Grid: Left = Network Card with Caption Bar & Stepper; Right = Accuracy Chart + Similarity Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
        <NetworkGraph
          clients={clients}
          isRunning={isRunning}
          isPaused={isPaused}
          currentRound={currentRound}
          currentStep={currentStep}
          selectedClient={selectedClient}
          onSelectClient={(id) => setSelectedClient(selectedClient === id ? null : id)}
          onStep={onStep}
          onTogglePause={onTogglePause}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <AccuracyChart
            history={accuracyHistory}
            currentRound={currentRound}
            totalRounds={totalRounds || 10}
          />
          <SimilarityChart clients={clients} currentRound={currentRound} />
        </div>
      </div>

      {/* 5. Round Log Card (Terminal view) */}
      <RoundLog logs={roundLogs} currentRound={currentRound} />

      {/* 6. Check Table (Full width 8 rows) */}
      <CheckTable
        clients={clients}
        currentStep={currentStep}
        verdicts={verdicts}
      />

      {/* 7. Summary Card on run_completed */}
      {runReport && (
        <SummaryCard
          currentScenario={config.scenario}
          runReport={runReport}
        />
      )}

      {/* 8. Event Log (Collapsed at bottom) */}
      <div className="glass-panel" style={{ padding: '0.9rem 1.25rem' }}>
        <div
          onClick={() => setIsEventStreamOpen(!isEventStreamOpen)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} color="var(--cyan-bright)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Raw Event Bus Stream
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({events.length} events logged)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <span>{isEventStreamOpen ? 'Collapse' : 'Expand'}</span>
            {isEventStreamOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>

        {isEventStreamOpen && (
          <div style={{ marginTop: '0.9rem' }}>
            <EventStream events={events} />
          </div>
        )}
      </div>
    </div>
  );
};
