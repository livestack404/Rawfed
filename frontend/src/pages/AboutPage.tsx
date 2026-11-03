import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Database, 
  Layers, 
  Lock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldCheck size={24} color="var(--cyan-bright)" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: '#ffffff' }}>
            System Architecture &amp; How It Works
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Plain-language summary of how the four modules fit together, how the defense detects attacks, and what the image guardrails actually do.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Module Separation Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cyan-bright)' }}>
            <Layers size={20} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              Code Module Separation
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Four modules with no cross-imports, so a bug or change in one cannot silently break another:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#67e8f9' }}>1. fl/ â€” Federated Learning</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Trains the pneumonia model locally on each hospital's data and averages the weight updates (FedAvg). It knows nothing about detection or the audit log.
              </p>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#34d399' }}>2. detection/ â€” Poisoning Defense</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Looks only at the numerical weight updates and uses cosine similarity + MAD scoring to flag updates that look like attacks. No image data, no blockchain.
              </p>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#c084fc' }}>3. blockchain/ â€” Audit Log</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Records a SHA-256 hash of each round's verdict so that any after-the-fact edits are detectable. It never influences which updates are included.
              </p>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#fbbf24' }}>4. orchestrator.py â€” Coordinator</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                The only file that imports all three modules. It runs the training loop and streams live updates to the browser over WebSocket.
              </p>
            </div>
          </div>
        </div>

        {/* Statistical Defense Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
            <Cpu size={20} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              Cosine-MAD Anomaly Defense
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Protects against both coarse sign-flip and subtle targeted label-flip attacks via multi-tiered statistical consensus:
          </p>

          <div style={{ background: 'rgba(11, 18, 32, 0.9)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>// 1. Coordinate-wise Median:</span>
              <div style={{ color: '#67e8f9' }}>V_med = median(Delta_1, ..., Delta_N)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>// 2. Cosine Similarity vs Consensus:</span>
              <div style={{ color: '#67e8f9' }}>S_i = (Delta_i · V_med) / (||Delta_i|| * ||V_med||)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>// 3. Median Absolute Deviation (MAD):</span>
              <div style={{ color: '#67e8f9' }}>MAD = median(|S_i - median(S)|)</div>
              <div style={{ color: '#67e8f9' }}>Robust_Z = (median(S) - S_i) / (1.4826 * MAD)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>// 4. Persistence Window:</span>
              <div style={{ color: '#34d399' }}>Exclude client iff Flagged ≥ K=2 of last M=3 rounds</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Warmup Grace Period:</strong> Exclusions trigger only after round 2 to allow honest heterogeneous local gradients to stabilize without false exclusion.
            </span>
          </div>
        </div>

        {/* Image Guardrails Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
            <Lock size={20} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              Image Guardrails (Hard Reject + Soft Warning)
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Before any image reaches the model, fast checks reject files that are clearly not chest X-rays. There are two tiers:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
              <strong style={{ color: '#f87171' }}>Hard Reject — image blocked, no result shown</strong>
              <ul style={{ color: 'var(--text-muted)', marginTop: '0.4rem', paddingLeft: '1.1rem', lineHeight: '1.7' }}>
                <li>File cannot be decoded as an image</li>
                <li>Either side is under 32 px (too small to analyse)</li>
                <li>Aspect ratio wider than 2.5 : 1 or taller than 1 : 0.4 (not X-ray shaped)</li>
                <li>Blank or flat — pixel standard deviation below 8 / 255</li>
                <li>Strongly coloured — mean RGB channel difference above 20 / 255 (not grayscale)</li>
              </ul>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(251,191,36,0.08)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.3)' }}>
              <strong style={{ color: '#fbbf24' }}>Soft Warning — result still shown, flagged as uncertain</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                If the model confidence is below 70 %, the prediction is returned but marked uncertain so the user knows to treat it with extra caution.
              </p>
            </div>
          </div>
        </div>

        {/* Audit Log Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc' }}>
            <Database size={20} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              Dual Blockchain &amp; Hash-Chain Audit Log
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Every round's outcome is written to an append-only log so that any later edits are detectable:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#c084fc' }}>Ganache EVM Smart Contract:</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                If a local Ethereum node (Ganache) is running, records are written to AuditLog.sol on-chain via JSON-RPC.
              </p>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: '#67e8f9' }}>Cryptographic Hash-Chain (Fallback):</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                When no blockchain is available, a SHA-256 linked chain is saved to disk. Each block stores the previous block's hash, so a single edit breaks every block that follows â€” and the Ledger page shows the failure instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Limitations Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
            <AlertCircle size={20} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              Limitations
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            The model is trained on a small pediatric dataset (PneumoniaMNIST). It catches nearly all pneumonia cases but misses some normal X-rays â€” meaning it can over-diagnose. These are research / demo results, not clinical-grade performance.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Dataset: </span>
              <strong style={{ color: '#ffffff' }}>MedMNIST PneumoniaMNIST (Pediatric Cohort)</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Specificity (Normal correctly identified): </span>
              <strong style={{ color: '#f59e0b' }}>76.1% (178 / 234 Normal verified)</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Sensitivity (Pneumonia caught): </span>
              <strong style={{ color: '#34d399' }}>97.4% (380 / 390 Pneumonia caught)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
