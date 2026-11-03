import React, { useState, useEffect } from 'react';
import {
  Server,
  Building2,
  ShieldAlert,
  XCircle,
  ShieldCheck,
  Database,
  Cpu,
  CheckCircle2,
  StepForward,
  Play,
  Pause,
} from 'lucide-react';
import { ClientNodeState } from '../types';

interface NetworkGraphProps {
  clients: ClientNodeState[];
  isRunning: boolean;
  isPaused?: boolean;
  currentRound: number;
  currentStep: number;
  selectedClient: number | null;
  onSelectClient: (id: number) => void;
  onStep?: () => void;
  onTogglePause?: () => void;
}

const STEP_SENTENCES: Record<number, string> = {
  1: 'Server sends the current model to every hospital',
  2: 'Each hospital trains on its own private X-rays',
  3: 'Hospitals send back only what they learned',
  4: 'Server checks every update for suspicious ones',
  5: 'Server combines the good updates into a better model',
  6: 'Every decision is recorded in the ledger',
};

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  clients,
  isRunning,
  isPaused = false,
  currentRound,
  currentStep,
  selectedClient,
  onSelectClient,
  onStep,
  onTogglePause,
}) => {
  const [dotProgress, setDotProgress] = useState(0);

  // Drive animation progress for Step 1 (server -> hospital) and Step 3 (hospital -> server)
  useEffect(() => {
    if (currentStep === 1 || currentStep === 3) {
      setDotProgress(0);
      const start = Date.now();
      const duration = 600; // 600ms or less per specification

      const frame = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(1, elapsed / duration);
        setDotProgress(p);
        if (p < 1) {
          requestAnimationFrame(frame);
        }
      };
      const handle = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(handle);
    } else {
      setDotProgress(0);
    }
  }, [currentStep, currentRound]);

  const centerX = 310;
  const centerY = 260;
  const radius = 195;

  const getNodeCoordinates = (index: number, total: number) => {
    const angle = (index * (2 * Math.PI) / total) - (Math.PI / 2);
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'EXCLUDED':
        return 'var(--orange-accent, #f97316)'; // orange
      case 'REJECTED':
        return '#ef4444'; // crimson
      case 'FLAGGED':
        return '#f59e0b'; // amber
      case 'ACCEPTED':
        return '#10b981'; // emerald
      case 'TRAINING':
        return '#06b6d4'; // cyan
      case 'SENT':
        return '#3b82f6'; // blue
      case 'IDLE':
      default:
        return '#64748b'; // neutral slate
    }
  };

  const activeStep = currentStep >= 1 && currentStep <= 6 ? currentStep : 1;
  const stepText = STEP_SENTENCES[activeStep] || 'Awaiting simulation round start...';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
      {/* ── Top Header & Action Controls ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>
            Hospital Network Simulation
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Live model updates between the central server and 8 simulated hospital nodes
          </p>
        </div>

        {/* Top-Right Corner: Step & Pause / Resume Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onTogglePause && isRunning && (
            <button
              className="btn-secondary"
              onClick={onTogglePause}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title={isPaused ? 'Resume simulation' : 'Pause simulation to step one phase at a time'}
            >
              {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          {onStep && (
            <button
              className="btn-primary"
              onClick={onStep}
              disabled={!isRunning || !isPaused}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.75rem',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: isRunning && isPaused ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.06)',
                color: isRunning && isPaused ? '#000000' : 'var(--text-muted)',
                border: isRunning && isPaused ? '1px solid var(--cyan-bright)' : '1px solid var(--border-subtle)',
              }}
              title={isRunning && isPaused ? 'Step forward one phase' : 'Pause simulation first to step one phase at a time'}
            >
              <StepForward size={14} />
              <span>Step</span>
            </button>
          )}
        </div>
      </div>

      {/* Legend Row */}
      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.725rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Accepted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Rejected
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--orange-accent, #f97316)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} /> Excluded
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--purple-accent)' }}>
          <ShieldAlert size={13} color="var(--purple-accent)" /> Compromised (set by the demo setup)
        </span>
      </div>

      {/* ── Caption Bar: Round N - Step k of 6 & Step sentence ───────── */}
      <div
        style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '8px',
          padding: '0.65rem 1rem',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--cyan-bright)' }}>
            Round {currentRound > 0 ? currentRound : 1} — Step {activeStep} of 6
          </span>
          <span style={{ fontSize: '0.825rem', color: '#ffffff', fontWeight: 500 }}>
            {stepText}
          </span>
        </div>

        {/* 6-segment progress stepper bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', height: '4px' }}>
          {[1, 2, 3, 4, 5, 6].map((st) => (
            <div
              key={`stepper-${st}`}
              style={{
                borderRadius: '2px',
                background: st <= activeStep ? 'var(--cyan-bright)' : 'rgba(255, 255, 255, 0.1)',
                boxShadow: st === activeStep ? '0 0 8px var(--cyan-bright)' : 'none',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── SVG Scene (Enlarged) ────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 620 520"
          style={{ width: '100%', maxWidth: '640px', height: 'auto', maxHeight: '520px' }}
        >
          <defs>
            <radialGradient id="serverGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Concentric Grid Rings */}
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
          <circle cx={centerX} cy={centerY} r={radius * 0.6} fill="none" stroke="rgba(255, 255, 255, 0.03)" />

          {/* Step 4 Server Ring Pulse */}
          {currentStep === 4 && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.45}
              fill="none"
              stroke="var(--amber-accent)"
              strokeWidth="2"
              className="pulse-glow"
            />
          )}

          {/* Data Conduit Lines & Animated Packet Transmission */}
          {clients.map((client, i) => {
            const { x, y } = getNodeCoordinates(i, clients.length);
            const statusColor = getStatusColor(client.status);
            const isExcluded = client.status === 'EXCLUDED';
            const isAccepted = client.status === 'ACCEPTED';

            // Step 1: Cyan dots travel from server to every hospital (progress 0 -> 1)
            // Step 3: White-blue dots travel from hospital back to server (progress 0 -> 1)
            let dotX = x;
            let dotY = y;
            let showDot = false;
            let dotColor = '#22d3ee';

            if (currentStep === 1) {
              showDot = true;
              dotColor = '#22d3ee'; // cyan
              dotX = centerX + (x - centerX) * dotProgress;
              dotY = centerY + (y - centerY) * dotProgress;
            } else if (currentStep === 3) {
              showDot = true;
              dotColor = '#93c5fd'; // white-blue
              dotX = x + (centerX - x) * dotProgress;
              dotY = y + (centerY - y) * dotProgress;
            }

            return (
              <g key={`conduit-${client.id}`}>
                {/* Conduit link: dashed orange for Excluded, flashing cyan/emerald at step 5 if Accepted */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke={
                    isExcluded
                      ? 'var(--orange-accent, #f97316)'
                      : currentStep === 5 && isAccepted
                      ? '#34d399'
                      : isRunning
                      ? 'rgba(6, 182, 212, 0.35)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                  strokeWidth={isExcluded ? 1.5 : currentStep === 5 && isAccepted ? 2.5 : 1}
                  strokeDasharray={isExcluded ? '4,4' : 'none'}
                />

                {/* Animated Dot driven by Step 1 or Step 3 */}
                {showDot && (
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r={3.5}
                    fill={dotColor}
                    filter="url(#glowEffect)"
                  />
                )}
              </g>
            );
          })}

          {/* Central Aggregation Server Node */}
          <g transform={`translate(${centerX - 36}, ${centerY - 36})`}>
            <circle
              cx="36"
              cy="36"
              r="40"
              fill="url(#serverGlow)"
              filter="url(#glowEffect)"
            />
            <circle
              cx="36"
              cy="36"
              r="34"
              fill="#080e1a"
              stroke="var(--cyan-primary)"
              strokeWidth="2"
            />
            <foreignObject x="18" y="14" width="36" height="36">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Server size={22} color="var(--cyan-bright)" />
              </div>
            </foreignObject>
            <text
              x="36"
              y="56"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontFamily="var(--font-display)"
              fontWeight="700"
            >
              FEDAVG
            </text>
          </g>

          {/* Step 5: Label 'new global model' appears briefly */}
          {currentStep === 5 && (
            <g transform={`translate(${centerX}, ${centerY - 52})`}>
              <rect x="-54" y="-11" width="108" height="22" rx="5" fill="#080e1a" stroke="#34d399" strokeWidth="1.2" />
              <text x="0" y="4.5" textAnchor="middle" fill="#34d399" fontSize="9.5" fontFamily="var(--font-display)" fontWeight="700">
                NEW GLOBAL MODEL
              </text>
            </g>
          )}

          {/* Step 6: Chain-block icon flashes '+8 entries' beside server */}
          {currentStep === 6 && (
            <g transform={`translate(${centerX + 48}, ${centerY - 10})`}>
              <rect x="0" y="-12" width="76" height="24" rx="6" fill="#080e1a" stroke="var(--purple-accent)" strokeWidth="1.2" />
              <foreignObject x="4" y="-8" width="16" height="16">
                <Database size={14} color="var(--purple-accent)" />
              </foreignObject>
              <text x="45" y="4.5" textAnchor="middle" fill="#c4b5fd" fontSize="9.5" fontFamily="var(--font-mono)" fontWeight="700">
                +8 entries
              </text>
            </g>
          )}

          {/* Hospital Client Nodes */}
          {clients.map((client, i) => {
            const { x, y } = getNodeCoordinates(i, clients.length);
            const statusColor = getStatusColor(client.status);
            const isSelected = selectedClient === client.id;
            const nodeRadius = 26;

            return (
              <g
                key={`node-${client.id}`}
                onClick={() => onSelectClient(client.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node selection ring */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={nodeRadius + 6}
                    fill="none"
                    stroke="var(--cyan-bright)"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Step 2 Pulsing Training Ring: All active hospitals train simultaneously */}
                {currentStep === 2 && client.status !== 'EXCLUDED' && (
                  <circle
                    cx={x}
                    cy={y}
                    r={nodeRadius + 6}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    className="pulse-glow"
                  />
                )}

                {/* Node background circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={nodeRadius}
                  fill="#0b1220"
                  stroke={statusColor}
                  strokeWidth={client.status === 'EXCLUDED' ? 2.5 : 1.5}
                />

                {/* Hospital Node Icon */}
                <foreignObject x={x - 12} y={y - 14} width="24" height="24">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {client.status === 'EXCLUDED' ? (
                      <XCircle size={16} color="var(--orange-accent, #f97316)" />
                    ) : client.status === 'REJECTED' ? (
                      <ShieldAlert size={16} color="#ef4444" />
                    ) : client.status === 'ACCEPTED' ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : (
                      <Building2 size={16} color={statusColor} />
                    )}
                  </div>
                </foreignObject>

                {/* Neutral Purple Compromised Marker (set by demo setup) */}
                {client.isMalicious && (
                  <g transform={`translate(${x - 32}, ${y - 42})`}>
                    <rect
                      width="64"
                      height="15"
                      rx="4"
                      fill="rgba(139, 92, 246, 0.3)"
                      stroke="var(--purple-accent)"
                      strokeWidth="1"
                    />
                    <text
                      x="32"
                      y="11"
                      textAnchor="middle"
                      fill="#ddd6fe"
                      fontSize="8"
                      fontFamily="var(--font-sans)"
                      fontWeight="700"
                    >
                      Compromised
                    </text>
                  </g>
                )}

                {/* Node Label (Enlarged) */}
                <text
                  x={x}
                  y={y + 36}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontFamily="var(--font-display)"
                  fontWeight="700"
                >
                  {client.name}
                </text>

                {/* Similarity / Status Subtext (Enlarged) */}
                <text
                  x={x}
                  y={y + 49}
                  textAnchor="middle"
                  fill={statusColor}
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {client.status !== 'Idle' && client.status !== 'Training' && client.status !== 'Sent'
                    ? `cos: ${client.similarity.toFixed(2)}`
                    : client.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Client Diagnostic Drawer */}
      {selectedClient !== null && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(13, 21, 37, 0.85)',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          {(() => {
            const sc = clients.find((c) => c.id === selectedClient);
            if (!sc) return null;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: getStatusColor(sc.status) + '22',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${getStatusColor(sc.status)}`,
                  }}>
                    <Building2 size={18} color={getStatusColor(sc.status)} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sc.name} (Client #{sc.id})</span>
                      {sc.isMalicious && (
                        <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                          <ShieldAlert size={10} color="var(--purple-accent)" />
                          Compromised
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Local Dataset: ~588 PneumoniaMNIST Chest X-rays
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>VERDICT</span>
                    <span style={{ fontWeight: 600, color: getStatusColor(sc.status) }}>
                      {sc.status}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>COSINE SIM</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {sc.similarity.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ROBUST Z (MAD)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {sc.robustZ.toFixed(2)}σ
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>PERSISTENCE</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {sc.kFlags} / 3 rounds
                    </span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
