# AntiFLearning: Project Assumptions & Design Decisions

This document records the architectural assumptions, implementation interpretations, and design parameters established per the specification prompt.

---

### 1. Dataset & Resolution
- **Dataset**: MedMNIST v2 PneumoniaMNIST (pediatric chest radiographs, binary classification: Normal vs. Pneumonia).
- **Demo Resolution**: 28x28 grayscale images are used for the 10-round interactive live simulation to ensure near-instantaneous client training in the browser.
- **Production Models**: Higher-resolution models are fully trained and stored in `models/`:
  - `final_model_64.pth` (validation accuracy 96.37%, test accuracy 85.10%, best round 30).
  - `final_model_128.pth` (validation accuracy 96.56%, test accuracy 89.42%, sensitivity 97.44%, best round 9).
  - The inference engine (`/api/predict`) dynamically selects the highest validation accuracy production model (defaulting to 128x128).

---

### 2. Partitioning & Clients
- **Federated Hospitals**: 8 simulated clinical sites (H1 through H8).
- **Data Distribution**: Non-IID Dirichlet distribution with concentration parameter alpha = 2.0, ensuring each hospital receives a realistic class imbalance while maintaining a minimum of 200 training examples per node.

---

### 3. Threat Model & Detection
- **Adversarial Setup**: Hospitals H4 (client 3) and H8 (client 7) act as compromised nodes in attacked and defended scenarios.
- **Attack Vector**: Label-flipping is the primary active attack mode; sign-flipping updates are supported in configuration.
- **Detector Consensus**:
  - Distance metric: Coordinate-wise median delta vector across all clients as the honest consensus reference.
  - Anomaly scoring: Head-Weighted Cosine Similarity combining the FC classification subnet and full parameter vector (`blended_cos = 0.70 * head_cos + 0.30 * full_cos`).
  - Robust Z-score: MAD-scaled Z-score computed on blended cosine for telemetry and UI visualization.
  - Rejection gating:
    - Warm-up (rounds 1 and 2): updates rejected if `blended_cos < -0.10`.
    - Round 3 onward: updates rejected if `blended_cos < 0.0` (honest non-IID updates maintain positive head cosine; label-flipping attackers invert head direction).
  - Cap: At most 3 updates are rejected in any single round (prioritizing lowest cosine similarity).
  - Quorum: Aggregation requires at least 3 accepted hospital updates.
  - Ground Truth Isolation: The detector receives zero information regarding client identities or adversarial status during evaluation. Ground truth is used strictly for post-run reporting.

---

### 4. Persistence & Trust Scoring
- **Trust Parameters**: Initialized at 100 points for all hospitals.
- **Penalties & Rewards**: Rejection deducts 30 points; acceptance restores 10 points (capped at 100).
- **Exclusion Threshold**: A hospital is excluded if its trust drops below 50 OR if it was rejected in 2 of the last 3 rounds.
- **Permanent Quarantine (Zero-Tolerance Policy)**: Once excluded, a hospital remains permanently quarantined for the remainder of the session (`status = "Excluded"`). Its updates are evaluated for telemetry but are strictly excluded from FedAvg aggregation, and its trust score is frozen. Active reinstatement was evaluated and permanently deprecated to prevent stealth oscillation attacks.

---

### 5. Blockchain & Ledger Verification
- **Smart Contract**: AuditLog.sol deployed to a local Ganache instance (http://127.0.0.1:8545).
- **On-Chain Data**: Only canonical SHA-256 record hashes, round numbers, hospital identifiers, and status codes are stored on-chain. Model weights and raw medical images are never placed on-chain.
- **Fallback**: When Ganache is not running, the system automatically falls back to an internal cryptographic hash-chain ledger.
- **Tampering Demonstration**: The tamper endpoint modifies only the local client copy, causing cryptographic verification against the chain to fail until restored.

---

### 6. Clinical Inference & Guardrails
- **Model Loading**: If the trained checkpoint is missing, /api/predict returns HTTP 503 ("Model not loaded"). It never predicts using uninitialized or random weights.
- **OOD Guardrails**: Lightweight image sanity checks (minimum dimension >= 32px, aspect ratio 0.4 - 2.5, grayscale variance std >= 8, color divergence <= 20/255). Complex feature-space Mahalanobis checks are removed.
- **Confidence Alerts**: Soft warning banner ("Uncertain, interpret with caution") is displayed for predictions where maximum probability < 0.70.
