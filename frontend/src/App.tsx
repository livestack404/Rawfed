import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { PredictPage } from './pages/PredictPage';
import { LedgerPage } from './pages/LedgerPage';
import { AboutPage } from './pages/AboutPage';
import { LearnPage } from './pages/LearnPage';
import { RoundLogData } from './components/RoundLog';
import { ClientNodeState, RoundMetrics, RunConfig, WSEvent } from './types';

const INITIAL_CLIENTS: ClientNodeState[] = [
  { id: 0, name: 'H1', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 1, name: 'H2', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 2, name: 'H3', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 3, name: 'H4', isMalicious: true, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 4, name: 'H5', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 5, name: 'H6', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 6, name: 'H7', isMalicious: false, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
  { id: 7, name: 'H8', isMalicious: true, status: 'Idle', similarity: 1.0, robustZ: 0.0, kFlags: 0 },
];

const DEFAULT_CONFIG: RunConfig = {
  scenario: 'defended',
  num_clients: 8,
  malicious_ids: [3, 7],
  detection: true,
  attack_type: 'label_flip',
  rounds: 10,
  local_epochs: 1,
  batch_size: 32,
  learning_rate: 0.001,
  speed_ms: 0,
  seed: 42,
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('learn');
  const [isConnected, setIsConnected] = useState(false);
  const [blockchainMode, setBlockchainMode] = useState<string>('mock');
  const [clients, setClients] = useState<ClientNodeState[]>(INITIAL_CLIENTS);
  const [metrics, setMetrics] = useState<RoundMetrics | null>(null);
  const [config, setConfig] = useState<RunConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(10);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [accuracyHistory, setAccuracyHistory] = useState<{ round: number; accuracy: number }[]>([]);
  const [verdicts, setVerdicts] = useState<Record<number, any> | null>(null);
  const [roundLogs, setRoundLogs] = useState<RoundLogData[]>([]);
  const [runReport, setRunReport] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // Scroll to top of page whenever active tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Sync malicious_ids whenever scenario / malicious_ids in config changes
  useEffect(() => {
    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        isMalicious: config.malicious_ids.includes(c.id),
      }))
    );
  }, [config.malicious_ids, config.scenario]);

  useEffect(() => {
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const payload: WSEvent = JSON.parse(event.data);
          handleWSEvent(payload);
        } catch (e) {
          console.error('Error parsing WS event', e);
        }
      };
    };

    connectWebSocket();

    // Fetch initial status from API
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setIsRunning(data.is_running);
        setIsPaused(data.is_paused);
        setCurrentRound(data.current_round);
        setTotalRounds(data.total_rounds || 10);
        setBlockchainMode(data.blockchain_mode);
      })
      .catch((err) => console.error('Error fetching initial status', err));

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleWSEvent = (event: WSEvent) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents((prev) => [...prev, { timestamp, type: event.type, data: event.data }]);

    switch (event.type) {
      case 'init':
        setIsRunning(event.data.is_running);
        setIsPaused(event.data.is_paused);
        setCurrentRound(event.data.current_round);
        setTotalRounds(event.data.total_rounds || 10);
        setBlockchainMode(event.data.blockchain_mode);
        break;

      // ── Phase 1: round_started & global_model_broadcast ──────────────────
      case 'round_started':
      case 'round_start': {
        const r = event.data.round;
        setIsRunning(true);
        setCurrentRound(r);
        setCurrentStep(1);
        setTotalRounds(event.data.total_rounds || totalRounds);
        setVerdicts(null);

        // Reset Accepted and Rejected to neutral 'Idle'; Excluded stays 'EXCLUDED'
        setClients((prev) =>
          prev.map((c) => ({
            ...c,
            status: c.status === 'EXCLUDED' ? 'EXCLUDED' : 'Idle',
          }))
        );

        setRoundLogs((prev) => {
          if (prev.some((rl) => rl.round === r)) return prev;
          return [
            ...prev,
            {
              round: r,
              step2Lines: [],
              step3Lines: [],
              step4Lines: [],
            },
          ];
        });
        break;
      }

      case 'global_model_broadcast': {
        const r = event.data.round;
        setCurrentStep(1);
        setRoundLogs((prev) =>
          prev.map((rl) =>
            rl.round === r
              ? {
                  ...rl,
                  step1: `Server sends global model v${event.data.model_version ?? r - 1} to H1 ... H8`,
                }
              : rl
          )
        );
        break;
      }

      // ── Phase 2: client_training ─────────────────────────────────────────
      case 'client_training': {
        const cid = event.data.client_id;
        const r = event.data.round;
        setCurrentStep(2);
        setClients((prev) =>
          prev.map((c) => (c.id === cid ? { ...c, status: 'Training' } : c))
        );
        const line = `H${cid + 1} trained on ${event.data.n_samples ?? 588} images, local loss ${(event.data.local_loss ?? 0).toFixed(4)}`;
        setRoundLogs((prev) =>
          prev.map((rl) => {
            if (rl.round !== r) return rl;
            if (rl.step2Lines.includes(line)) return rl;
            return { ...rl, step2Lines: [...rl.step2Lines, line] };
          })
        );
        break;
      }

      // ── Phase 3: client_update_sent ──────────────────────────────────────
      case 'client_update_sent': {
        const cid = event.data.client_id;
        const r = event.data.round;
        setCurrentStep(3);
        setClients((prev) =>
          prev.map((c) => (c.id === cid ? { ...c, status: 'Sent' } : c))
        );
        const line = `H${cid + 1} sent update (size ${(event.data.update_norm ?? 0).toFixed(4)})`;
        setRoundLogs((prev) =>
          prev.map((rl) => {
            if (rl.round !== r) return rl;
            if (rl.step3Lines.includes(line)) return rl;
            return { ...rl, step3Lines: [...rl.step3Lines, line] };
          })
        );
        break;
      }

      // ── Phase 4: detection_complete ──────────────────────────────────────
      case 'detection_complete': {
        const r = event.data.round;
        setCurrentStep(4);
        const records: Record<string, any> = event.data.records_by_client || {};
        setVerdicts(records);

        const s4Lines: string[] = [];
        setClients((prev) =>
          prev.map((c) => {
            const verdict = records[String(c.id)];
            if (!verdict) return c;
            const statusMap: Record<string, any> = {
              Accepted: 'ACCEPTED',
              Rejected: 'REJECTED',
              Excluded: 'EXCLUDED',
            };
            const mapped = statusMap[verdict.status] ?? c.status;
            const sim = (verdict.cosine_similarity ?? 1.0).toFixed(4);
            const trust = verdict.trust_after ?? 100;
            const line = `Check: H${c.id + 1} similarity ${sim} trust ${trust} ${
              verdict.status === 'Accepted'
                ? 'ACCEPTED'
                : `REJECTED: ${verdict.reason_text || 'Outlier direction'}`
            }`;
            s4Lines.push(line);

            return {
              ...c,
              similarity: verdict.cosine_similarity ?? c.similarity,
              robustZ: verdict.robust_z ?? c.robustZ,
              status: mapped,
              kFlags:
                verdict.status === 'Rejected'
                  ? c.kFlags + 1
                  : verdict.status === 'Excluded'
                  ? c.kFlags
                  : c.kFlags,
              reason: verdict.reason_text,
            };
          })
        );

        setRoundLogs((prev) =>
          prev.map((rl) => (rl.round === r ? { ...rl, step4Lines: s4Lines } : rl))
        );
        break;
      }

      // ── Phase 5: aggregation_complete ────────────────────────────────────
      case 'aggregation_complete': {
        const r = event.data.round;
        const acc = event.data.accuracy ?? 0;
        const loss = event.data.loss ?? 0;
        setCurrentStep(5);

        setAccuracyHistory((prev) => [
          ...prev.filter((p) => p.round !== r),
          { round: r, accuracy: acc },
        ]);

        setMetrics({
          round: r,
          accuracy: acc,
          loss: loss,
          precision: event.data.metrics?.precision ?? 0,
          recall: event.data.metrics?.recall ?? 0,
          f1: event.data.metrics?.f1 ?? 0,
          trusted_clients: event.data.trusted_count ?? 0,
          excluded_clients: event.data.excluded_count ?? 0,
          blockchain_ms: 0,
        });

        const s5Line = `Aggregated ${event.data.trusted_count ?? 8} of 8 updates. New model v${event.data.model_version ?? r}: validation accuracy ${(acc * 100).toFixed(1)}%, loss ${loss.toFixed(4)}`;
        setRoundLogs((prev) =>
          prev.map((rl) => (rl.round === r ? { ...rl, step5: s5Line } : rl))
        );
        break;
      }

      // ── Phase 6: ledger_written ──────────────────────────────────────────
      case 'ledger_written': {
        const r = event.data.round;
        setCurrentStep(6);
        setMetrics((prev) =>
          prev ? { ...prev, blockchain_ms: event.data.blockchain_ms ?? prev.blockchain_ms } : prev
        );
        const s6Line = `${event.data.entries_count ?? 8} decisions written to ledger (${event.data.mode ?? blockchainMode})`;
        setRoundLogs((prev) =>
          prev.map((rl) => (rl.round === r ? { ...rl, step6: s6Line } : rl))
        );
        break;
      }

      // ── Round & Run Lifecycle ────────────────────────────────────────────
      case 'round_completed': {
        const rec = event.data.record;
        const r = event.data.round;
        const sumLine = `Round ${r}: accepted ${rec?.trusted_clients ?? 8}, rejected ${rec?.excluded_clients ?? 0}, accuracy ${((rec?.accuracy ?? 0) * 100).toFixed(1)}%`;
        setRoundLogs((prev) =>
          prev.map((rl) => (rl.round === r ? { ...rl, summary: sumLine } : rl))
        );
        break;
      }

      case 'run_completed':
        setIsRunning(false);
        setIsPaused(false);
        setRunReport(event.data.detection_report || {});
        break;

      default:
        break;
    }
  };

  const handleStart = async () => {
    try {
      setAccuracyHistory([]);
      setRoundLogs([]);
      setVerdicts(null);
      setRunReport(null);
      setCurrentStep(1);

      await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setIsRunning(true);
      setIsPaused(false);
    } catch (e) {
      console.error('Failed to start simulation', e);
    }
  };

  const handleTogglePause = async () => {
    try {
      if (isPaused) {
        await fetch('/api/resume', { method: 'POST' });
        setIsPaused(false);
      } else {
        await fetch('/api/pause', { method: 'POST' });
        setIsPaused(true);
      }
    } catch (e) {
      console.error('Failed to toggle pause', e);
    }
  };

  const handleStep = async () => {
    try {
      await fetch('/api/step', { method: 'POST' });
    } catch (e) {
      console.error('Failed to step simulation', e);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
      setIsRunning(false);
      setIsPaused(false);
    } catch (e) {
      console.error('Failed to stop simulation', e);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      setIsRunning(false);
      setIsPaused(false);
      setCurrentRound(0);
      setCurrentStep(1);
      setMetrics(null);
      setAccuracyHistory([]);
      setVerdicts(null);
      setRoundLogs([]);
      setRunReport(null);
      setEvents([]);
      setClients(INITIAL_CLIENTS.map((c) => ({
        ...c,
        isMalicious: config.malicious_ids.includes(c.id),
      })));
    } catch (e) {
      console.error('Failed to reset simulation', e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        blockchainMode={blockchainMode}
        isRunning={isRunning}
        currentRound={currentRound}
        totalRounds={totalRounds}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'learn' && (
          <ErrorBoundary label="Learn">
            <LearnPage
              onTryLive={() => setActiveTab('dashboard')}
              onSeePredictions={() => setActiveTab('predict')}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'dashboard' && (
          <ErrorBoundary label="Simulation">
            <Dashboard
              clients={clients}
              metrics={metrics}
              config={config}
              onChangeConfig={setConfig}
              isRunning={isRunning}
              isPaused={isPaused}
              currentStep={currentStep}
              currentRound={currentRound}
              totalRounds={totalRounds}
              accuracyHistory={accuracyHistory}
              verdicts={verdicts}
              roundLogs={roundLogs}
              runReport={runReport}
              onStart={handleStart}
              onTogglePause={handleTogglePause}
              onStep={handleStep}
              onReset={handleReset}
              events={events}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'predict' && (
          <ErrorBoundary label="Predict">
            <PredictPage />
          </ErrorBoundary>
        )}

        {activeTab === 'ledger' && (
          <ErrorBoundary label="Ledger">
            <LedgerPage />
          </ErrorBoundary>
        )}

        {activeTab === 'about' && (
          <ErrorBoundary label="About">
            <AboutPage />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.25rem 2rem',
        marginTop: '2rem',
        background: 'var(--bg-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>AntiFLearning Architecture</strong>
          <span>•</span>
          <span>Zero-Trust Poisoning Defense & Blockchain Audit Logger for Healthcare</span>
        </div>
        <div>
          <span>MedMNIST Pneumonia (4,708 Train / 624 Test) · {blockchainMode === 'ganache' ? 'Ganache EVM' : 'SHA-256 Hash-Chain'} · PyTorch Grad-CAM</span>
        </div>
      </footer>
    </div>
  );
};
