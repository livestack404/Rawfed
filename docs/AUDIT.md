# Codebase Audit Report: Federated Healthcare Security Prototype

**Project:** Federated Learning with Poisoning Attack Detection and Blockchain Audit Logging for Healthcare  
**Audit Date:** September 2026  
**Auditor:** Senior Full-Stack + ML Engineer  

---

## 1. Executive Summary

An audit of the existing prototype (`D:\FL_Project\fl-healthcare-security`) was performed to evaluate its components against the requirements for a demo-ready localhost prototype.

While the existing codebase demonstrated the core feasibility of running Flower/PyTorch with PneumoniaMNIST and interacting with Ganache, several critical architectural and algorithmic elements were either broken, simplified, or missing.

Below is the detailed classification of what **works**, what was **missing or broken**, and what must be **kept vs. rewritten**.

---

## 2. Component-by-Component Audit

### 2.1 Machine Learning & Dataset (`model/`, `data/`)
- **Status:** **PARTIALLY WORKING / REQUIRES REFACTOR**
- **What works:**
  - `PneumoniaMNIST` loads correctly from `.npz` files (4,708 train / 624 test images, 28x28 grayscale, binary classification).
  - Small CNN architecture (2 Conv layers, MaxPool, Dropout, 2 Linear layers) trains reliably on CPU and achieves ~85-89% test accuracy.
- **What was missing / broken:**
  - Dataset partitioning was rigid and lacked mild IID variations with seeded reproducible distribution across 8 hospital clients.
  - The model did not expose penultimate-layer feature extraction for the Mahalanobis Out-Of-Distribution (OOD) distance check.
  - No explicit FedAvg interface decoupled from Flower's heavyweight orchestration (which can hang on Windows multiprocessing).

### 2.2 Poisoning Attacks (`attacks/`)
- **Status:** **WORKING**
- **What works:**
  - `sign_flip` effectively reverses gradient/weight directions and degrades global model accuracy when unmitigated.
  - `label_flip` switches label 0 (Normal) and 1 (Pneumonia) during client local training.
- **What was missing / broken:**
  - Needs clean abstraction into `fl/attack.py` adhering to the separation rule (no leakage into `detection/` or `blockchain/`).

### 2.3 Detection Engine (`detection/`)
- **Status:** **BROKEN / INADEQUATE FOR PRODUCTION SPEC**
- **What works:**
  - Basic cosine similarity against the median vector of client updates.
- **What was missing / broken:**
  - **Fixed threshold flaw:** Used a static hardcoded threshold (0.5), which causes false positives under diverse data splits or fails under subtle attacks.
  - **No Robust Z-score / MAD (Median Absolute Deviation):** Missing adaptive statistical distance scoring.
  - **No Persistence Tracking ($K$ of last $M$ rounds):** In the original code, a single round anomaly could immediately ban a client; spec mandates exclusion only after being flagged $K$ of last $M$ rounds, with an initial warm-up period.
  - **Multi-seed verification:** Lacked automated multi-seed verification tests.

### 2.4 Blockchain Audit Logger (`blockchain/`)
- **Status:** **PARTIALLY WORKING**
- **What works:**
  - Solidity contract `AuditLogger.sol` with `logContribution`, `getEntry`, `totalEntries`, emitting `AuditLogged` events.
  - Web3.py integration to Ganache over HTTP RPC (`http://127.0.0.1:8545`).
- **What was missing / broken:**
  - **Mock chain was an in-memory stub:** When Ganache was unavailable, it defaulted to an in-memory array that did not persist to disk, had no cryptographic block hashing (`prev_hash`, `sha256`), and could not genuinely support the "Try to edit a past entry" and "Verify ledger integrity" demonstration.
  - Mode transitions were not smoothly reported via WebSocket to the frontend.

### 2.5 Explainability & OOD Guardrails (`xai/`)
- **Status:** **BROKEN / HIGH BUG RISK**
- **What works:**
  - Basic PyTorch Grad-CAM calculation existed.
- **What was missing / broken:**
  - **Critical OOD bug:** Non-chest X-rays, blank images, and colored photos were routinely classified as "Pneumonia" or "Normal" with high confidence.
  - **Static text:** Explanations were pre-written templates rather than dynamically generated from actual Grad-CAM activation zones (upper/middle/lower, left/right lung fields, coverage %, intensity).
  - Lacked the two explanation toggles: Plain-language (patient-friendly) vs Clinical detail.
  - Missing penultimate-layer class mean and covariance Mahalanobis distance calculator.

### 2.6 Server, Orchestrator & State (`backend/`)
- **Status:** **BROKEN / ARCHITECTURAL VIOLATIONS**
- **What works:**
  - FastAPI endpoints for starting training.
- **What was missing / broken:**
  - **No Separation Rule:** Server imports crossed boundaries between FL, detection, and blockchain.
  - **Polling instead of WebSocket:** Frontend polled `/status`, causing UI lag and race conditions.
  - Missing granular real-time event pipeline (`round_start`, `client_status`, `similarity`, `flag`, `exclude`, `aggregate`, `metrics`, `chain_write`, `round_end`, `run_end`, `error`).
  - No background task control with true Pause / Stop / Reset / Replay capabilities.

### 2.7 Frontend
- **Status:** **INADEQUATE / REBUILD REQUIRED**
- **What works:**
  - Basic Next.js page with component panels.
- **What was missing / broken:**
  - Not an App Router multi-page navigation architecture (`/` Dashboard, `/predict`, `/ledger`, `/results`, `/about`).
  - Lacked the custom "clinical-cyber" dark design system (navy/graphite, cyan accents, crisp typography).
  - No animated SVG / Canvas node graph showing central aggregation server and orbiting hospital nodes with live weight packet transmissions.
  - No interactive sample picker (Normal, Pneumonia, Reject Demo non-X-ray).
  - No live ledger tamper demonstration with cryptographic re-hashing feedback.

---

## 3. Plan of Action (What to Keep vs. Rebuild)

| Component | Decision | Rationale |
|---|---|---|
| `data/medmnist/pneumoniamnist.npz` | **KEEP** | Standardized 4.1MB dataset already downloaded and verified. |
| `fl/model.py` | **REVISE & EXTEND** | Keep the lightweight CNN topology; add penultimate feature extraction hooks for Mahalanobis OOD. |
| `fl/attack.py` | **REFACTOR** | Consolidate `label_flip` and `sign_flip` with clean interfaces. |
| `detection/detector.py` | **REWRITE** | Implement median cosine similarity + MAD robust z-scores + $K$-of-$M$ persistence with warmup. |
| `blockchain/` | **REWRITE** | Update `AuditLog.sol`, rewrite `mock_ledger.py` with persistent SHA-256 hash chains for authentic tamper verification. |
| `xai/` | **REWRITE** | Implement robust Grad-CAM + dynamic zone-based text generator + multi-stage OOD filters (format, blank, color, aspect, softmax < 0.70, Mahalanobis). |
| `backend/app/orchestrator.py` | **NEW** | Central orchestrator enforcing strict boundary separation and async event streaming. |
| `frontend/` | **REBUILD FROM SCRATCH** | Next.js 14/15 App Router, TypeScript, Tailwind CSS, Recharts, Framer Motion, clinical-cyber design system. |
