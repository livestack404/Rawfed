export type ScenarioType = 'clean' | 'attacked' | 'defended' | 'custom';
export type AttackType = 'label_flip' | 'sign_flip';
export type ClientStatus = 'Idle' | 'Training' | 'Sent' | 'ACCEPTED' | 'FLAGGED' | 'EXCLUDED' | 'REJECTED';

export interface RunConfig {
  scenario: ScenarioType;
  num_clients: number;
  malicious_ids: number[];
  detection: boolean;
  attack_type: AttackType;
  rounds: number;
  local_epochs: number;
  batch_size: number;
  learning_rate: number;
  speed_ms: number;
  seed: number;
}

export interface ClientNodeState {
  id: number;
  name: string;
  isMalicious: boolean;
  status: ClientStatus;
  similarity: number;
  robustZ: number;
  kFlags: number;
  reason?: string;
  sampleCount?: number;
}

export interface RoundMetrics {
  round: number;
  accuracy: number;
  loss: number;
  precision: number;
  recall: number;
  f1: number;
  trusted_clients: number;
  excluded_clients: number;
  blockchain_ms: number;
}

export interface LedgerEntry {
  index: number;
  run_id?: string;
  round: number;
  hospital_id: string;
  client_id: number;
  /** Backend returns "Accepted" | "Rejected" | "Excluded" (title-case) */
  status: string;
  reason_text: string;
  cosine_similarity: number;
  robust_z: number;
  norm_ratio?: number;
  trust_before: number;
  trust_after: number;
  update_hash: string;
  fingerprint: string;
  // present only in ganache / hash-chain mode
  block_hash?: string;
  prev_hash?: string;
  timestamp?: number;
}

export interface LedgerMismatch {
  index: number;
  reason: string;
  expected_blockchain_fingerprint?: string;
  actual_local_fingerprint?: string;
  local_record?: any;
}

export interface VerificationResult {
  valid: boolean;
  message?: string;
  reason?: string;
  total_entries: number;
  mismatch_count?: number;
  mismatches?: LedgerMismatch[];
  tampered_index?: number;
  expected_prev_hash?: string;
  actual_prev_hash?: string;
  expected_block_hash?: string;
  actual_block_hash?: string;
  latest_block_hash?: string;
  mode?: string;
  mode_badge?: string;
  mode_display?: string;
}

export interface WSEvent {
  type:
    // Backend canonical event names (orchestrator.py)
    | 'init'
    | 'round_started'
    | 'global_model_broadcast'
    | 'client_training'
    | 'client_update_sent'
    | 'detection_complete'
    | 'aggregation_complete'
    | 'ledger_written'
    | 'round_completed'
    | 'run_completed'
    // Legacy / alternative names (kept for compatibility)
    | 'round_start'
    | 'client_status_batch'
    | 'similarity'
    | 'flag'
    | 'exclude'
    | 'aggregate'
    | 'metrics'
    | 'chain_write'
    | 'round_end'
    | 'run_end'
    | 'error';
  data: any;
}

/**
 * A benchmark sample image returned by GET /api/samples.
 * Fields mirror the backend response exactly:
 *   id, filename, label ("Normal" | "Pneumonia"), label_idx (0 | 1),
 *   image_url and image_data_url are both the data: URI base-64 PNG.
 */
export interface SampleImage {
  id: string;
  filename: string;
  label: 'Normal' | 'Pneumonia';
  label_idx: 0 | 1;
  image_url?: string;
  image_data_url?: string;
  // Optional legacy / enriched fields (may be absent)
  name?: string;
  description?: string;
  expected?: string;
  type?: 'valid' | 'invalid';
}

/**
 * Prediction result from POST /api/predict or POST /api/predict/sample/{id}.
 * `status === 'accepted'` ⟹ full classification fields are present.
 * `status === 'rejected'` ⟹ only `reason`, `error_type`, `is_ood` are meaningful.
 */
export interface PredictionResult {
  status: 'accepted' | 'rejected';
  is_ood: boolean;
  error_type?: string;
  reason?: string;
  prediction?: 'Normal' | 'Pneumonia';
  predicted_class?: number;
  confidence?: number;
  confidence_percentage?: number;
  probabilities?: {
    normal: number;
    pneumonia: number;
  };
  uncertain?: boolean;
  heatmap_data_url?: string;
  /** Single-sentence Grad-CAM caption returned by the backend. */
  caption?: string;
  /** Raw diagnostic telemetry included in OOD rejection responses. */
  details?: any;
  disclaimer: string;
  // Sample-prediction enrichment (only present for /api/predict/sample/:id)
  sample_id?: string;
  filename?: string;
  true_label?: string;
  true_label_idx?: number;
  is_match?: boolean;
}

export interface ScenarioResultData {
  scenario: string;
  config: RunConfig;
  rounds: RoundMetrics[];
  elapsed_seconds: number;
  final_metrics: RoundMetrics;
}
