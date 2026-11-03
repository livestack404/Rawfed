import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  ShieldAlert, 
  Database, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  HelpCircle, 
  Lock, 
  FileText, 
  Server, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  TrendingUp,
  Building2
} from 'lucide-react';
import { ALL_LEARN_STEPS, LearnStep } from '../data/learnSteps';

interface LearnPageProps {
  onTryLive: () => void;
  onSeePredictions: () => void;
}

export const LearnPage: React.FC<LearnPageProps> = ({
  onTryLive,
  onSeePredictions,
}) => {
  const [activePart, setActivePart] = useState<1 | 2 | 3>(1);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const steps: LearnStep[] = ALL_LEARN_STEPS[activePart] || [];
  const currentStep = steps[currentStepIdx] || steps[0];
  const totalSteps = steps.length;

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentStepIdx((idx) => Math.min(totalSteps - 1, idx + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIdx((idx) => Math.max(0, idx - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSteps]);

  const handleSelectPart = (part: 1 | 2 | 3) => {
    setActivePart(part);
    setCurrentStepIdx(0);
  };

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  // Hospital coordinates in SVG viewBox (760 x 420)
  const centerX = 380;
  const centerY = 210;
  const radius = 155; // Balanced slight size bump from 145 for clear readability without crowding

  const getHospitalCoords = (i: number) => {
    const angle = (i * (2 * Math.PI) / 8) - (Math.PI / 2);
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Page Header & Part Tabs ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: '#ffffff', margin: 0 }}>
            The Federated Learning Ecosystem
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
            Interactive algorithmic walkthrough of privacy-preserving training, poisoning threats, and blockchain verification
          </p>
        </div>

        {/* 3 Part Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => handleSelectPart(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activePart === 1 ? '1px solid var(--cyan-primary)' : '1px solid transparent',
              background: activePart === 1 ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
              color: activePart === 1 ? 'var(--cyan-bright)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Share2 size={16} />
            <span>Federated Learning</span>
          </button>

          <button
            onClick={() => handleSelectPart(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activePart === 2 ? '1px solid var(--purple-accent)' : '1px solid transparent',
              background: activePart === 2 ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
              color: activePart === 2 ? '#c4b5fd' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ShieldAlert size={16} />
            <span>Poisoning Defense</span>
          </button>

          <button
            onClick={() => handleSelectPart(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activePart === 3 ? '1px solid #10b981' : '1px solid transparent',
              background: activePart === 3 ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
              color: activePart === 3 ? '#6ee7b7' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={16} />
            <span>Blockchain Log</span>
          </button>
        </div>
      </div>

      {/* ── Step Bar Above Scene (minmax(0, 1fr) prevents grid blowout) ── */}
      <div
        className="glass-panel"
        style={{
          padding: '0.75rem 1rem',
          display: 'grid',
          gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))`,
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        {steps.map((st, idx) => {
          const isActive = idx === currentStepIdx;
          const isPassed = idx < currentStepIdx;

          return (
            <div
              key={`step-bar-${idx}`}
              onClick={() => setCurrentStepIdx(idx)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                cursor: 'pointer',
                opacity: isActive ? 1 : isPassed ? 0.8 : 0.45,
                transition: 'opacity 0.2s ease',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    minWidth: '18px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: isActive ? 'var(--cyan-bright)' : isPassed ? '#10b981' : 'rgba(255,255,255,0.1)',
                    color: isActive || isPassed ? '#080c14' : '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {st.step}
                </div>
                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--cyan-bright)' : 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {st.shortLabel}
                </span>
              </div>
              <div
                style={{
                  height: '3px',
                  borderRadius: '2px',
                  background: isActive ? 'var(--cyan-bright)' : isPassed ? '#10b981' : 'rgba(255,255,255,0.08)',
                  boxShadow: isActive ? '0 0 8px var(--cyan-bright)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Main Section: Left = SVG Scene, Right = Interactive Caption Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* Left: SVG Visual Scene */}
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '540px',
            background: 'rgba(8, 12, 20, 0.9)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Watermark Label */}
          <div
            style={{
              position: 'absolute',
              bottom: '0.75rem',
              right: '1rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Illustration. Real numbers are on the Simulation page.
          </div>

          <svg viewBox="0 0 760 420" style={{ width: '100%', height: 'auto', maxHeight: '500px' }}>
            <defs>
              <radialGradient id="learnServerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* PART 1 SCENE */}
            {activePart === 1 && (
              <>
                {/* Step 2: Mini-panels (Old way vs Our way) */}
                {currentStep.step === 2 ? (
                  <g>
                    {/* Old Way Panel */}
                    <foreignObject x="35" y="45" width="335" height="330">
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: '#0b1220',
                          border: '1.5px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          boxSizing: 'border-box',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: '#f87171',
                              fontSize: '1.05rem',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              marginBottom: '0.75rem',
                            }}
                          >
                            The Old Way (Centralized)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                              Images leave hospitals to a central server
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f87171', fontWeight: 600, lineHeight: '1.4' }}>
                              <span style={{ fontSize: '1rem', lineHeight: 1 }}>✕</span>
                              <span>Violates patient privacy regulations</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: 'auto 0 0.5rem 0' }}>
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '50%',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '2px solid #ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <XCircle size={30} color="#ef4444" />
                          </div>
                          <span style={{ color: '#fca5a5', fontSize: '0.825rem', fontWeight: 600 }}>
                            Privacy Breach Risk
                          </span>
                        </div>
                      </div>
                    </foreignObject>

                    {/* Our Way Panel */}
                    <foreignObject x="390" y="45" width="335" height="330">
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: '#0b1220',
                          border: '1.5px solid rgba(16, 185, 129, 0.5)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          boxSizing: 'border-box',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: '#34d399',
                              fontSize: '1.05rem',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              marginBottom: '0.75rem',
                            }}
                          >
                            Our Way (Federated Learning)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                              X-rays remain locked behind hospital firewalls
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#34d399', fontWeight: 600, lineHeight: '1.4' }}>
                              <span style={{ fontSize: '1rem', lineHeight: 1 }}>✓</span>
                              <span>Only model weight deltas ever travel</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: 'auto 0 0.5rem 0' }}>
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '50%',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '2px solid #10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 size={30} color="#10b981" />
                          </div>
                          <span style={{ color: '#86efac', fontSize: '0.825rem', fontWeight: 600 }}>
                            Strict Zero-Trust Privacy
                          </span>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                ) : (
                  <>
                    {/* Concentric guide circles */}
                    <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />

                    {/* Central Server Node */}
                    <g transform={`translate(${centerX - 35}, ${centerY - 35})`}>
                      <circle cx="35" cy="35" r="35" fill="#080e1a" stroke="var(--cyan-primary)" strokeWidth="2.2" />
                      <foreignObject x="22" y="14" width="26" height="26">
                        <Server size={26} color="var(--cyan-bright)" />
                      </foreignObject>
                      <text x="35" y="58" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">SERVER</text>
                    </g>

                    {/* 8 Hospitals */}
                    {Array.from({ length: 8 }).map((_, i) => {
                      const pos = getHospitalCoords(i);
                      const isTraining = currentStep.step === 5;
                      const isSending = currentStep.step === 4;
                      const isReturning = currentStep.step === 6;

                      return (
                        <g key={`h-p1-${i}`}>
                          {/* Conduit line */}
                          <line
                            x1={centerX}
                            y1={centerY}
                            x2={pos.x}
                            y2={pos.y}
                            stroke={isTraining ? 'var(--cyan-bright)' : 'rgba(255,255,255,0.1)'}
                            strokeWidth={isTraining ? 2 : 1.2}
                          />

                          {/* Step 4: Model copy traveling to hospital */}
                          {isSending && (
                            <circle
                              cx={centerX + (pos.x - centerX) * 0.6}
                              cy={centerY + (pos.y - centerY) * 0.6}
                              r="5"
                              fill="var(--cyan-bright)"
                            />
                          )}

                          {/* Step 6: Update card traveling back to server */}
                          {isReturning && (
                            <circle
                              cx={pos.x + (centerX - pos.x) * 0.6}
                              cy={pos.y + (centerY - pos.y) * 0.6}
                              r="4.5"
                              fill="#93c5fd"
                            />
                          )}

                          {/* Hospital node */}
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r="25"
                            fill="#0b1220"
                            stroke={isTraining ? '#06b6d4' : '#64748b'}
                            strokeWidth={isTraining ? 2.5 : 1.5}
                          />
                          <text x={pos.x} y={pos.y - 4} textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="700">
                            H{i + 1}
                          </text>

                          {/* Small Lock & X-ray Icons */}
                          <foreignObject x={pos.x - 14} y={pos.y + 2} width="28" height="16">
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', alignItems: 'center' }}>
                              <Lock size={10.5} color="#34d399" />
                              <FileText size={10.5} color="var(--cyan-bright)" />
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}

                    {/* Step 7 & 8: Merge animation & accuracy meter badge */}
                    {(currentStep.step === 7 || currentStep.step === 8) && (
                      <g transform={`translate(${centerX - (currentStep.step === 8 ? 68 : 58)}, ${centerY - 68})`}>
                        <rect
                          x="0"
                          y="0"
                          width={currentStep.step === 8 ? 136 : 116}
                          height="24"
                          rx="5"
                          fill="#080e1a"
                          stroke="#10b981"
                          strokeWidth="1.2"
                        />
                        <text
                          x={currentStep.step === 8 ? 68 : 58}
                          y="16.5"
                          textAnchor="middle"
                          fill="#34d399"
                          fontSize="11.5"
                          fontWeight="700"
                        >
                          {currentStep.step === 8 ? 'Round 2 v1 Model' : 'Aggregated v1'}
                        </text>
                      </g>
                    )}
                  </>
                )}
              </>
            )}

            {/* PART 2 SCENE: POISONING */}
            {activePart === 2 && (
              <>
                <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />

                {/* Central Server */}
                <g transform={`translate(${centerX - 35}, ${centerY - 35})`}>
                  <circle cx="35" cy="35" r="35" fill="#080e1a" stroke="var(--cyan-primary)" strokeWidth="2.2" />
                  <foreignObject x="22" y="14" width="26" height="26">
                    <Server size={26} color="var(--cyan-bright)" />
                  </foreignObject>
                  <text x="35" y="58" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">SERVER</text>
                </g>

                {/* Step 4: Vector comparison diagram */}
                {currentStep.step === 4 ? (
                  <g transform={`translate(${centerX - 170}, ${centerY - 115})`}>
                    <rect
                      x="0"
                      y="0"
                      width="340"
                      height="230"
                      rx="12"
                      fill="#080e1a"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.5"
                    />
                    <text x="170" y="28" textAnchor="middle" fill="#ffffff" fontSize="13.5" fontWeight="700">
                      Weight Direction Comparison (Cosine Similarity)
                    </text>

                    {/* Vector Origin and Arrows */}
                    <g transform="translate(170, 115)">
                      {/* Honest Cluster (Pointing forward/upward) */}
                      {[-40, -25, -10, 5, 20, 35].map((angle, k) => (
                        <line
                          key={`honest-vec-${k}`}
                          x1="0"
                          y1="0"
                          x2={65 * Math.cos(((angle - 90) * Math.PI) / 180)}
                          y2={65 * Math.sin(((angle - 90) * Math.PI) / 180)}
                          stroke="#10b981"
                          strokeWidth="2.8"
                        />
                      ))}
                      <text x="80" y="-35" fill="#34d399" fontSize="10.5" fontWeight="600">
                        Honest (H1-H3, H5-H7)
                      </text>

                      {/* 2 Poisoned Vectors (H4 and H8, pointing backward/downward) */}
                      <line x1="0" y1="0" x2="-48" y2="48" stroke="#ef4444" strokeWidth="3.2" />
                      <line x1="0" y1="0" x2="48" y2="48" stroke="#ef4444" strokeWidth="3.2" />
                      <text x="0" y="72" textAnchor="middle" fill="#f87171" fontSize="10.5" fontWeight="600">
                        Poisoned Updates (H4, H8)
                      </text>

                      {/* Origin Dot */}
                      <circle cx="0" cy="0" r="4.5" fill="var(--cyan-bright)" />
                    </g>

                    <text x="170" y="212" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">
                      Cosine threshold identifies opposite angles
                    </text>
                  </g>
                ) : (
                  <>
                    {/* 8 Hospitals */}
                    {Array.from({ length: 8 }).map((_, i) => {
                      const pos = getHospitalCoords(i);
                      const isAttacker = i === 3 || i === 7; // H4 and H8
                      const isRejected = isAttacker && currentStep.step >= 5;

                      return (
                        <g key={`h-p2-${i}`}>
                          <line
                            x1={centerX}
                            y1={centerY}
                            x2={pos.x}
                            y2={pos.y}
                            stroke={isRejected ? 'var(--orange-accent, #f97316)' : 'rgba(255,255,255,0.1)'}
                            strokeWidth={isRejected ? 1.8 : 1.2}
                            strokeDasharray={isRejected ? '4,4' : 'none'}
                          />

                          {/* Hospital circle */}
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r="25"
                            fill="#0b1220"
                            stroke={isRejected ? 'var(--orange-accent, #f97316)' : '#64748b'}
                            strokeWidth={isRejected ? 2.5 : 1.5}
                          />

                          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="700">
                            H{i + 1}
                          </text>

                          {/* Purple Compromised Marker (setup attribute) */}
                          {isAttacker && (
                            <g transform={`translate(${pos.x - 38}, ${pos.y - 42})`}>
                              <rect width="76" height="16" rx="4" fill="rgba(139, 92, 246, 0.25)" stroke="var(--purple-accent)" strokeWidth="0.8" />
                              <text x="38" y="11.5" textAnchor="middle" fill="#c4b5fd" fontSize="9.5" fontWeight="600">Compromised</text>
                            </g>
                          )}

                          {/* Step 2: Flipped label illustration pill */}
                          {isAttacker && currentStep.step === 2 && (
                            <g transform={`translate(${pos.x - 42}, ${pos.y + 28})`}>
                              <rect width="84" height="16" rx="4" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="0.8" />
                              <text x="42" y="11.5" textAnchor="middle" fill="#fca5a5" fontSize="9" fontWeight="700">
                                FLIPPED LABELS
                              </text>
                            </g>
                          )}

                          {/* Step 5: Excluded tag */}
                          {isRejected && (
                            <g transform={`translate(${pos.x - 30}, ${pos.y + 28})`}>
                              <rect width="60" height="16" rx="4" fill="rgba(249, 115, 22, 0.25)" stroke="var(--orange-accent, #f97316)" strokeWidth="0.8" />
                              <text x="30" y="11.5" textAnchor="middle" fill="#fb923c" fontSize="9.5" fontWeight="700">EXCLUDED</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* PART 3 SCENE: BLOCKCHAIN LOG */}
            {activePart === 3 && (
              <g transform="translate(30, 75)">
                {/* Decision Record Box */}
                <rect x="0" y="30" width="235" height="195" rx="12" fill="#0b1220" stroke="var(--border-subtle)" strokeWidth="1.2" />
                <text x="20" y="62" fill="var(--cyan-bright)" fontSize="16" fontWeight="700">Audit Record</text>
                <text x="20" y="92" fill="var(--text-secondary)" fontSize="13">Round: 1 • Hospital: H4</text>
                <text x="20" y="116" fill="#f87171" fontSize="13" fontWeight="600">Status: Excluded</text>
                <text x="20" y="138" fill="var(--text-muted)" fontSize="12">Cosine Sim: -0.4281</text>
                <text x="20" y="160" fill="var(--text-muted)" fontSize="12">Trust Score: 60 / 100</text>
                <text x="20" y="190" fill="#a78bfa" fontSize="11" fontFamily="var(--font-mono)">
                  Hash: {currentStep.step === 3 ? '0xTAMPERED_ERR...' : '0x7f8a92bc31...'}
                </text>

                {/* Arrow to Blockchain */}
                <line x1="245" y1="125" x2="310" y2="125" stroke="var(--cyan-bright)" strokeWidth="2" strokeDasharray="4,4" />
                <ArrowRight x="310" y="117" size={16} color="var(--cyan-bright)" />

                {/* Blockchain Blocks with Chain Links */}
                <g transform="translate(330, 30)">
                  {/* Chain connector links */}
                  <line x1="92" y1="46" x2="118" y2="46" stroke="rgba(167, 139, 250, 0.6)" strokeWidth="3" />
                  <line
                    x1="210"
                    y1="46"
                    x2="236"
                    y2="46"
                    stroke={currentStep.step === 3 ? '#ef4444' : 'rgba(167, 139, 250, 0.6)'}
                    strokeWidth="3"
                    strokeDasharray={currentStep.step === 3 ? '3,3' : 'none'}
                  />

                  {[1, 2, 3].map((bNum) => {
                    const blockX = (bNum - 1) * 118;
                    const isTampered = currentStep.step === 3 && bNum === 2;

                    return (
                      <g key={`block-${bNum}`} transform={`translate(${blockX}, 0)`}>
                        <rect
                          x="0"
                          y="0"
                          width="92"
                          height="92"
                          rx="10"
                          fill="#080e1a"
                          stroke={isTampered ? '#ef4444' : 'var(--purple-accent)'}
                          strokeWidth={isTampered ? 2 : 1.5}
                        />
                        <text x="46" y="28" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="700">
                          Block #{bNum}
                        </text>
                        <text x="46" y="50" textAnchor="middle" fill="var(--text-muted)" fontSize="10.5" fontFamily="var(--font-mono)">
                          Prev: {bNum === 1 ? '0x000' : '0x7f8'}
                        </text>
                        <g transform="translate(18, 62)">
                          <rect
                            x="0"
                            y="0"
                            width="56"
                            height="18"
                            rx="4"
                            fill={isTampered ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'}
                            stroke={isTampered ? '#ef4444' : '#10b981'}
                            strokeWidth="0.8"
                          />
                          <text
                            x="28"
                            y="12.5"
                            textAnchor="middle"
                            fill={isTampered ? '#f87171' : '#34d399'}
                            fontSize="9.5"
                            fontWeight="700"
                            fontFamily="var(--font-mono)"
                          >
                            {isTampered ? 'INVALID' : 'SEALED'}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>

                {/* Step 3: Verify Cross */}
                {currentStep.step === 3 && (
                  <g transform="translate(420, 155)">
                    <rect x="0" y="0" width="200" height="38" rx="8" fill="rgba(239,68,68,0.18)" stroke="#ef4444" strokeWidth="1.2" />
                    <text x="100" y="24" textAnchor="middle" fill="#fca5a5" fontSize="13" fontWeight="700">
                      ✕ Tampering Detected!
                    </text>
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Right: Caption & Interactive Control Panel */}
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '540px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            {/* Step Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                Step {currentStep.step} of {totalSteps}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Use Left / Right arrow keys
              </span>
            </div>

            {/* Step Caption */}
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', lineHeight: '1.5', marginBottom: '1rem', wordBreak: 'break-word' }}>
              {currentStep.caption}
            </h3>

            {/* Common Confusion Box on Part 1 Step 8 */}
            {currentStep.confusionBox && (
              <div
                style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  marginTop: '1rem',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--cyan-bright)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  <HelpCircle size={15} style={{ flexShrink: 0 }} />
                  <span>Common Confusion</span>
                </div>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45', wordBreak: 'break-word' }}>
                  {currentStep.confusionBox}
                </p>
              </div>
            )}

            {/* Legend on Part 2 Steps */}
            {activePart === 2 && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  marginTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  fontSize: '0.75rem',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                  Threat Legend
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--purple-accent)' }}>
                  <ShieldAlert size={13} color="var(--purple-accent)" style={{ flexShrink: 0 }} />
                  <span>Compromised (set by demo setup)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                  <span style={{ width: '8px', height: '8px', minWidth: '8px', flexShrink: 0, borderRadius: '50%', background: '#ef4444' }} />
                  <span>Rejected (anomalous update dropped)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--orange-accent, #f97316)' }}>
                  <span style={{ width: '8px', height: '8px', minWidth: '8px', flexShrink: 0, borderRadius: '50%', background: '#f97316' }} />
                  <span>Excluded (persistent attacker quarantined)</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions: Back, Dots, Next, and Try Live Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                onClick={handleBack}
                disabled={currentStepIdx === 0}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {/* Progress Dots */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {steps.map((_, idx) => (
                  <div
                    key={`dot-ctrl-${idx}`}
                    onClick={() => setCurrentStepIdx(idx)}
                    style={{
                      width: idx === currentStepIdx ? '18px' : '7px',
                      height: '7px',
                      borderRadius: '4px',
                      background: idx === currentStepIdx ? 'var(--cyan-bright)' : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={currentStepIdx === totalSteps - 1}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Try It Live Button after completion of last step */}
            {currentStepIdx === totalSteps - 1 && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button
                  className="btn-primary"
                  onClick={onTryLive}
                  style={{ flex: 1, background: '#10b981', color: '#ffffff', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Play size={15} fill="currentColor" />
                  <span>Try it live</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={onSeePredictions}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Cpu size={15} />
                  <span>See predictions</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
