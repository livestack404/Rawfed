import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Database, 
  Info, 
  Wifi, 
  WifiOff, 
  Cpu, 
  Lock,
  BookOpen
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  blockchainMode: string;
  isRunning: boolean;
  currentRound: number;
  totalRounds: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  blockchainMode,
  isRunning,
  currentRound,
  totalRounds,
}) => {
  const navItems = [
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'dashboard', label: 'Simulation', icon: Activity },
    { id: 'predict', label: 'Predict', icon: Cpu },
    { id: 'ledger', label: 'Ledger', icon: Database },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(8, 12, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.75rem 2rem',
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(16, 185, 129, 0.2))',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
          }}>
            <ShieldCheck size={22} color="var(--cyan-bright)" />
            {isRunning && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--emerald-accent)',
                boxShadow: '0 0 8px var(--emerald-accent)',
              }} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #ffffff, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                AntiFLearning
              </span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
              Zero-Trust Healthcare Federated Learning
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.3rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(2, 132, 199, 0.25))' : 'transparent',
                  color: isActive ? 'var(--cyan-bright)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderBottom: isActive ? '1px solid var(--cyan-primary)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none',
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System Badges & Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Simulation Progress Pill */}
          {isRunning && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '20px',
              fontSize: '0.75rem',
              color: 'var(--cyan-bright)',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--cyan-bright)',
                boxShadow: '0 0 8px var(--cyan-bright)',
              }} className="pulse-glow" />
              <span>Round {currentRound} / {totalRounds}</span>
            </div>
          )}

          {/* Blockchain Mode Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '20px',
            fontSize: '0.75rem',
            color: 'var(--cyan-bright)',
          }}>
            <Lock size={13} />
            <span>
              {blockchainMode === 'ganache'
                ? 'Ganache Blockchain'
                : 'Local Hash-Chain'}
            </span>
          </div>

          {/* Connection Chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '20px',
            fontSize: '0.75rem',
            color: isConnected ? '#34d399' : '#f87171',
          }}>
            {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
