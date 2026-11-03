# AntiFLearning: Federated Healthcare Security Prototype

**Federated Learning with Poisoning Attack Detection and Blockchain Audit Logging for Healthcare.**

AntiFLearning demonstrates a zero-trust federated learning system where 8 simulated hospital nodes collaboratively train a pneumonia classification CNN on pediatric chest radiographs (PneumoniaMNIST) without centralizing patient images. Compromised hospitals attempting data poisoning (label-flipping or sign-flipping) are dynamically detected via robust statistical consensus (median cosine similarity + MAD robust Z-score + persistent trust scoring) and excluded from aggregation. Every verification verdict and record fingerprint is committed to an immutable blockchain ledger (Ganache with automatic cryptographic fallback).

---

## Architecture Overview

- **Federated Training Engine**: Plain PyTorch FedAvg (no Flower dependency).
- **Backend**: FastAPI with async WebSocket streaming (`/ws`) for live event dispatching.
- **Poisoning Defense Engine**: Coordinate-wise median delta consensus, MAD-scaled robust Z-scores, and dynamic trust scoring (100 baseline, -30 on rejection, +10 on acceptance, exclusion below 50 or on 2 of 3 flags).
- **Audit Logging**: Ethereum EVM smart contract (`AuditLog.sol`) deployed to Ganache, with an automated cryptographic hash-chain fallback.
- **Clinical Inference & XAI**: PyTorch PneumoniaCNN inference with input sanity guardrails (size, format, blank/contrast, color deviation, soft confidence floor) and Grad-CAM visual heatmaps.
- **Frontend**: React + Vite + TypeScript single-page application with responsive telemetry, network transmission graph, and audit log inspection.

---

## Prerequisites

- **Python**: 3.10+ (tested on Python 3.12)
- **Node.js**: v18+ and npm
- **Ganache** (Optional for live Ethereum blockchain; automatic local cryptographic fallback included)

---

## Quickstart

### 1. Backend Setup

```bash
# Activate virtual environment
.venv\Scripts\activate   # Windows

# Install Python dependencies
pip install -r backend/requirements.txt

# Start FastAPI backend server (runs on port 8000)
python scripts/start_backend.py
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 3. Ganache Blockchain (Optional)

To run a persistent Ganache blockchain instance:

```bash
npx ganache --database.dbPath ./ganache-db --wallet.deterministic --server.port 8545
```

If Ganache is not running, AntiFLearning automatically falls back to its local cryptographic SHA-256 hash-chain ledger.

---

## Running Automated Scenarios

To execute and record the three standard 10-round evaluation scenarios (`clean`, `attacked`, `defended`):

```bash
python scripts/run_experiments.py 10
```

Results are saved to `experiments/results/{clean,attacked,defended}/`.

---

## Running Tests

Run the backend test suite:

```bash
python -m pytest
```
"# Rawfed" 
"# Rawfed" 
