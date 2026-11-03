# Audit Verification Report: AntiFLearning Project

**Audit Reference:** Section 2 & Section 8 of Update Prompt
**Date:** October 2026

Below is the verification of every audit finding against the codebase before making any modifications.

---

### Step 0 Audit Findings (Section 2)

1. **Predict loads `best_model.pth`, which is the 28x28 demo model, and that checkpoint is chosen by test accuracy (leakage).**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [main.py](file:///d:/AntiFLearning/backend/app/main.py#L76-L83): `get_inference_model()` loads `config.CHECKPOINTS_DIR / "best_model.pth"`, which is inside `experiments/results/defended`.
     - In [orchestrator.py](file:///d:/AntiFLearning/backend/app/orchestrator.py#L247-L296): Evaluation per round runs on `test_loader` (`metrics = server.evaluate(test_loader)`), and `if metrics["accuracy"] >= best_accuracy: best_accuracy = metrics["accuracy"]; torch.save(server.global_model.state_dict(), best_path)`. The demo checkpoint is chosen by test accuracy (leakage).

2. **If the checkpoint is missing, `main.py` continues with a freshly initialized model (explains "same result for every upload").**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [main.py](file:///d:/AntiFLearning/backend/app/main.py#L86-L91): If `best_path` does not exist or fails to load, `main.py` logs `"No checkpoint found at best_model.pth. Using freshly initialized model."` and continues with `_inference_model = model`, serving random uninitialized weights instead of returning HTTP 503.

3. **Image resizing for Predict is hardcoded to 28x28.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [xai/ood.py](file:///d:/AntiFLearning/backend/app/xai/ood.py#L71-L74): `resized_pil = gray_img.resize((28, 28), Image.Resampling.BILINEAR)`. The resizing dimension is hardcoded to `(28, 28)`.

4. **The multi-stage OOD guardrail (`xai/ood.py`, including Mahalanobis distance) is too strict and complex.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [xai/ood.py](file:///d:/AntiFLearning/backend/app/xai/ood.py#L101-L123) and [orchestrator.py](file:///d:/AntiFLearning/backend/app/orchestrator.py#L45-L87): Implements penultimate feature-space extraction, computing class means and shared inverted covariance matrices to evaluate Mahalanobis distance with percentile thresholds.

5. **The detector tracks past flags (K-of-M) but exclusion does not really use them. Saved defended run excluded counts per round were 2,2,2,2,0,2,0,2,0,2 and accuracy dipped in the zero-exclusion rounds.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [detector.py](file:///d:/AntiFLearning/backend/app/detection/detector.py#L115-L163): `is_persistent = (k_flags >= self.persistence_k)` is computed, but `excluded_ids` is purely populated by `flagged_candidates[:max_excluded]` (single-round outlier check sorted by similarity), ignoring persistent exclusion status.
     - In [experiments/results/defended/metrics.json](file:///d:/AntiFLearning/experiments/results/defended/metrics.json#L28-L127): The `excluded_clients` across rounds 1 to 10 are exactly `2, 2, 2, 2, 0, 2, 0, 2, 0, 2`. In rounds 5, 7, and 9 (where 0 clients were excluded), accuracy dipped sharply to `0.7372`, `0.8061`, and `0.7500`.

6. **Partitioning is near-IID (Dirichlet alpha about 15).**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [data/partition.py](file:///d:/AntiFLearning/backend/app/data/partition.py#L40): Explicitly set to `alpha = 15.0` (`dirichlet_0 = rng.dirichlet(np.full(num_clients, alpha))`).

7. **The orchestrator emits training and sent events but no event for "server sends global model to hospitals".**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [orchestrator.py](file:///d:/AntiFLearning/backend/app/orchestrator.py#L173-L181): The orchestrator calls `global_weights = server.get_global_weights()`, but immediately emits `"client_status_batch" ("Training")` with no `global_model_broadcast` event.

8. **The ledger tamper endpoints alter ledger data itself, which contradicts the blockchain immutability story.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [main.py](file:///d:/AntiFLearning/backend/app/main.py#L266-L270) and [mock_ledger.py](file:///d:/AntiFLearning/backend/app/blockchain/mock_ledger.py#L142-L162): `tamper_ledger` directly modifies `self.entries[index]["status"] = new_status` in `mock_ledger.py`, rather than cleanly separating the immutable chain store from local mutable records. Furthermore, `AuditLog.sol` stores full strings and details on chain rather than a canonical record fingerprint.

9. **UI leftovers: "AegisFL" branding, a "Stream Live" badge, a "SHA-256 HashChain" label, a speed slider, and a separate Results page.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - `AegisFL`: Found in [Navbar.tsx](file:///d:/AntiFLearning/frontend/src/components/Navbar.tsx#L37), [App.tsx](file:///d:/AntiFLearning/frontend/src/App.tsx#L182), [ResultsPage.tsx](file:///d:/AntiFLearning/frontend/src/pages/ResultsPage.tsx#L55), and [index.html](file:///d:/AntiFLearning/frontend/index.html#L7).
     - `"Stream Live"` badge: Found in [Navbar.tsx](file:///d:/AntiFLearning/frontend/src/components/Navbar.tsx#L50).
     - `"SHA-256 HashChain"` label: Found in [Navbar.tsx](file:///d:/AntiFLearning/frontend/src/components/Navbar.tsx#L76).
     - Speed slider: Found in [ControlsPanel.tsx](file:///d:/AntiFLearning/frontend/src/components/ControlsPanel.tsx#L106-L121).
     - Results page: Present as a standalone tab and route in [App.tsx](file:///d:/AntiFLearning/frontend/src/App.tsx#L196) and [ResultsPage.tsx](file:///d:/AntiFLearning/frontend/src/pages/ResultsPage.tsx).

10. **Repo hygiene: empty README (and stack lines that do not match reality), `_recon/` scratch tests, a `vite.config.ts.timestamp-*.mjs` file, `test_upload_image.png`, config says 50 rounds but saved demo runs are 10.**
    - **Status:** **CONFIRMED**
    - **Evidence:**
      - [README.md](file:///d:/AntiFLearning/README.md) is empty (contains only `# AntiFLearning`).
      - `_recon/` directory exists with temporary scratch test scripts.
      - `frontend/vite.config.ts.timestamp-1790675848255-2023fb1dd5ff08.mjs` exists.
      - `test_upload_image.png` exists in repository root.
      - In [config.py](file:///d:/AntiFLearning/backend/app/config.py#L33): `NUM_ROUNDS: int = 50`, while all saved demo runs in `experiments/results` are 10 rounds.

11. **The saved results in `experiments/results/{clean,attacked,defended}` came from the old logic and must be regenerated after the detector change.**
    - **Status:** **CONFIRMED**
    - **Evidence:**
      - The saved runs in `experiments/results` reflect the previous detector logic and 0-exclusion oscillations.

---

### Step 0 UI Audit Additions (Section 8)

(a) **`LiveMetricsCards.tsx` labels accuracy "test set" and loss "Holdout 624 cases".**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [LiveMetricsCards.tsx](file:///d:/AntiFLearning/frontend/src/components/LiveMetricsCards.tsx#L44): `<span style={{ fontSize: '0.7rem', color: '#34d399' }}>test set</span>`.
     - In [LiveMetricsCards.tsx](file:///d:/AntiFLearning/frontend/src/components/LiveMetricsCards.tsx#L69): `<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Holdout 624 cases</span>`.

(b) **`Dashboard.tsx` passes a hardcoded `threshold={0.50}` to `SimilarityChart`.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [Dashboard.tsx](file:///d:/AntiFLearning/frontend/src/pages/Dashboard.tsx#L75): `<SimilarityChart clients={clients} threshold={0.50} />`.

(c) **`NetworkGraph.tsx` colors packets red when `client.isMalicious`, and the live client state may carry that flag.**
   - **Status:** **CONFIRMED**
   - **Evidence:**
     - In [NetworkGraph.tsx](file:///d:/AntiFLearning/frontend/src/components/NetworkGraph.tsx#L56): `return isMalicious ? '#ef4444' : '#64748b';`.
     - In [NetworkGraph.tsx](file:///d:/AntiFLearning/frontend/src/components/NetworkGraph.tsx#L157): `fill={client.isMalicious ? '#ef4444' : '#22d3ee'}` colors packets red before detection.
     - In [App.tsx](file:///d:/AntiFLearning/frontend/src/App.tsx#L11-L18) and [App.tsx](file:///d:/AntiFLearning/frontend/src/App.tsx#L55): `isMalicious` is maintained in live client state and used directly in the graph.
