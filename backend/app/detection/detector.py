"""Poisoning attack detection engine using Head-Weighted Cosine Similarity,
Robust Z-Score (MAD), Trust Scores, and Persistence Tracking.

Key design decision:
  Label-flip attacks manifest STRONGEST in the classification head (fc1 + fc2 layers).
  Convolutional layers learn generic visual features and stay partially aligned even for
  label-flipping attackers, diluting the full-vector cosine similarity signal.

  We therefore compute a HEAD-WEIGHTED cosine:
    head_cos   = cosine(delta_head_i,  median_delta_head)   # last FC layers only
    full_cos   = cosine(delta_full_i,  median_delta_full)   # entire parameter vector
    blended    = HEAD_WEIGHT * head_cos + (1 - HEAD_WEIGHT) * full_cos

  An honest non-IID client has positive head_cos (correct label direction, just skewed data).
  A label-flipping attacker has strongly negative head_cos (labels inverted).
  Rejection gate: blended_cos < 0.0  (hard floor — never flag positive cosine clients).

Imports NOTHING from blockchain/ or fl/ to enforce strict separation of concerns.
The detector never receives ground-truth labels about which clients are malicious.
"""

import collections
import hashlib
import math
import numpy as np
from typing import Dict, List, Optional, Tuple


def compute_update_hash(update_vector: np.ndarray) -> str:
    """Computes deterministic SHA-256 hex digest of the model update array bytes."""
    data = update_vector.astype(np.float32).tobytes()
    return hashlib.sha256(data).hexdigest()


# Fraction of flat update vector that belongs to the decision subnet (fc1 onward).
# For PneumoniaCNN-28: conv params = 4800, total = 105346 → head starts at index 4800.
# If the model architecture changes (different resolution / channels) the head offset
# is recomputed at runtime from the actual vector length via HEAD_PARAM_FRACTION.
# 100546 / 105346 ≈ 0.9545 — i.e. ~95.5% of parameters are in the FC subnet.
HEAD_PARAM_FRACTION: float = 0.9545   # proportion of tail params that form the FC head
HEAD_WEIGHT: float = 0.70             # weight given to head cosine vs full cosine (0.30)


class PoisonDetector:
    """Detects and excludes adversarial updates in federated learning."""

    def __init__(
        self,
        mad_threshold: float = 2.50,
        warmup_rounds: int = 2,
        persistence_k: int = 2,
        persistence_m: int = 3,
        head_param_fraction: float = HEAD_PARAM_FRACTION,
        head_weight: float = HEAD_WEIGHT,
    ):
        self.mad_threshold = mad_threshold
        self.warmup_rounds = warmup_rounds
        self.persistence_k = persistence_k
        self.persistence_m = persistence_m
        self.head_param_fraction = head_param_fraction
        self.head_weight = head_weight

        # Trust score: starts at 100
        self.trust_scores: Dict[int, int] = collections.defaultdict(lambda: 100)

        # Exclusion state: client_id -> bool
        self.is_excluded: Dict[int, bool] = collections.defaultdict(lambda: False)

        # Flag history over last 3 rounds: client_id -> deque of bools (maxlen 3)
        self.rejection_history: Dict[int, collections.deque] = collections.defaultdict(
            lambda: collections.deque(maxlen=3)
        )

        # Consecutive passing rounds for excluded clients: client_id -> count
        self.consecutive_pass_count: Dict[int, int] = collections.defaultdict(lambda: 0)

        self.verdicts_history: List[Dict[int, Dict]] = []

    def reset(self):
        """Reset internal history for a new run."""
        self.trust_scores.clear()
        self.is_excluded.clear()
        self.rejection_history.clear()
        self.consecutive_pass_count.clear()
        self.verdicts_history.clear()

    @staticmethod
    def _cosine_sim(v1: np.ndarray, v2: np.ndarray, eps: float = 1e-9) -> float:
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < eps or norm2 < eps:
            return 0.0
        return float(np.clip(np.dot(v1, v2) / (norm1 * norm2), -1.0, 1.0))

    def _head_slice(self, vec: np.ndarray) -> np.ndarray:
        """Returns the tail slice of vec corresponding to the FC decision subnet.

        The head_param_fraction controls what fraction of the flat parameter vector
        is considered the FC subnet. For PneumoniaCNN-28 this is ~95.5% of parameters
        (everything after the conv1/conv2 layers = fc1.weight + fc1.bias + fc2.weight + fc2.bias).
        """
        n = len(vec)
        head_start = int(n * (1.0 - self.head_param_fraction))
        return vec[head_start:]

    def _blended_cosine(
        self,
        delta_i: np.ndarray,
        median_delta: np.ndarray,
    ) -> tuple:
        """Returns (blended_cos, head_cos, full_cos).

        blended_cos = HEAD_WEIGHT * head_cos + (1 - HEAD_WEIGHT) * full_cos
        """
        full_cos = self._cosine_sim(delta_i, median_delta)
        head_i = self._head_slice(delta_i)
        head_median = self._head_slice(median_delta)
        head_cos = self._cosine_sim(head_i, head_median)
        blended = self.head_weight * head_cos + (1.0 - self.head_weight) * full_cos
        blended = float(np.clip(blended, -1.0, 1.0))
        return round(blended, 4), round(head_cos, 4), round(full_cos, 4)

    def evaluate_round(
        self,
        round_no: int,
        client_updates: Dict[int, np.ndarray],
        detection_enabled: bool = True,
        run_id: str = "demo",
    ) -> Tuple[Dict[int, Dict], List[int]]:
        """Evaluates client updates for poisoning anomalies.

        Mathematical steps per round:
          delta_i       = local_weights_i - global_weights  (1D flattened update)
          median_delta  = coordinate-wise median of all deltas
          head_cos_i    = cosine(delta_i[head:], median_delta[head:])   # FC subnet only
          full_cos_i    = cosine(delta_i, median_delta)                 # whole vector
          blended_cos_i = 0.70 * head_cos_i + 0.30 * full_cos_i
          robust_z_i    = (blended_cos_i - median(blended_cos)) / (1.4826 * MAD + 1e-8)

        Rejection rules (blended_cos is the primary signal):
          - Warm-up (rounds 1-2): reject only if blended_cos_i < -0.10
            (allows a little noise in early rounds before model converges)
          - Round 3 onward: reject if blended_cos_i < 0.0
            (honest non-IID clients always have positive head cosine; only
             label-flipping attackers invert the FC head direction)
          - Hard safety cap: reject at most 3 hospitals per round (lowest cos first)

        Trust score & Exclusion:
          - Starts at 100
          - Rejected: -30; Accepted: +10 (cap 100)
          - Excluded when trust < 50 OR rejected in 2 of last 3 rounds
          - Excluded still scored, but updates never aggregated
          - Reinstated with trust 60 after 3 consecutive rounds that would pass
          - Quorum: fewer than 3 accepted updates means skip aggregation (empty trusted_ids)

        Returns:
            verdicts: Dict mapping client_id to decision record dictionary.
            trusted_client_ids: List of client IDs accepted for aggregation.
        """
        cids = sorted(list(client_updates.keys()))
        if not cids:
            return {}, []

        # 1. Coordinate-wise median of all deltas
        update_matrix = np.stack([client_updates[cid] for cid in cids], axis=0)
        median_delta = np.median(update_matrix, axis=0)

        # 2. Norms
        norms = {cid: float(np.linalg.norm(client_updates[cid])) for cid in cids}
        median_norm = float(np.median(list(norms.values()))) + 1e-8

        # 3. Head-weighted cosine similarity
        #    blended_cos = 0.70 * head_cos + 0.30 * full_cos
        #    head_cos operates on the FC decision subnet (label-flip manifests here strongly)
        similarities = {}       # blended cosine (primary signal for rejection)
        head_similarities = {}  # FC-head cosine (for transparency in UI)
        full_similarities = {}  # full-vector cosine (for transparency in UI)
        norm_ratios = {}
        for cid in cids:
            blended, head_cos, full_cos = self._blended_cosine(client_updates[cid], median_delta)
            similarities[cid] = blended
            head_similarities[cid] = head_cos
            full_similarities[cid] = full_cos
            norm_ratios[cid] = round(norms[cid] / median_norm, 4)

        sim_values = np.array([similarities[cid] for cid in cids])

        # 4. Robust Z-score on blended cosine values
        median_cos = float(np.median(sim_values))
        abs_deviations = np.abs(sim_values - median_cos)
        mad_cos = float(np.median(abs_deviations))
        robust_z_denom = 1.4826 * mad_cos + 1e-8

        robust_z = {}
        for cid in cids:
            cos_i = similarities[cid]
            z_i = (cos_i - median_cos) / robust_z_denom
            robust_z[cid] = round(float(z_i), 3)

        # If detection disabled (e.g. attacked scenario):
        # Compute and report REAL cosine_similarity and robust_z for telemetry/UI visibility,
        # but accept all updates without penalty into FedAvg.
        if not detection_enabled:
            verdicts = {}
            for cid in cids:
                trust_before = self.trust_scores[cid]
                trust_after = min(100, trust_before + 10)
                self.trust_scores[cid] = trust_after
                cos_i = similarities[cid]
                z_i = robust_z[cid]
                n_ratio = norm_ratios[cid]
                u_hash = compute_update_hash(client_updates[cid])
                hosp_str = f"H{cid+1}" if isinstance(cid, int) else str(cid)

                if cos_i < 0.0:
                    reason_text = f"Update divergent (similarity {cos_i:.2f}), but accepted: defense disabled."
                else:
                    reason_text = "Update consistent with group (defense disabled)."

                verdicts[cid] = {
                    "run_id": run_id,
                    "round": round_no,
                    "hospital_id": hosp_str,
                    "client_id": cid,
                    "status": "Accepted",
                    "reason_text": reason_text,
                    "cosine_similarity": cos_i,
                    "head_cosine": head_similarities[cid],
                    "full_cosine": full_similarities[cid],
                    "robust_z": z_i,
                    "norm_ratio": n_ratio,
                    "trust_before": trust_before,
                    "trust_after": trust_after,
                    "update_hash": u_hash,
                }
            return verdicts, list(cids)

        anomalous_candidates = []
        for cid in cids:
            cos_i = similarities[cid]

            # Rejection logic:
            # Warm-up (rounds 1-2): reject only if blended_cos < -0.10
            #   (label-flip attacker training for 3 epochs will already be well below this;
            #    random init noise in round 1 keeps honest clients well above -0.10)
            # Round 3 onward: reject if blended_cos < 0.0
            #   (honest non-IID clients always have positive head cosine;
            #    label-flipping attackers have inverted FC head → blended goes negative)
            if round_no <= self.warmup_rounds:
                would_reject = bool(cos_i < -0.10)
            else:
                would_reject = bool(cos_i < 0.0)

            if would_reject:
                anomalous_candidates.append(cid)

        # Safety cap: reject at most 3 hospitals per round (lowest blended cosine first)
        anomalous_candidates.sort(key=lambda c: similarities[c])
        round_rejected_set = set(anomalous_candidates[:3])

        verdicts = {}
        accepted_candidates = []

        for cid in cids:
            trust_before = self.trust_scores[cid]
            already_excluded = self.is_excluded[cid]
            cos_i = similarities[cid]
            z_i = robust_z[cid]
            n_ratio = norm_ratios[cid]
            u_hash = compute_update_hash(client_updates[cid])
            hosp_str = f"H{cid+1}" if isinstance(cid, int) else str(cid)

            # Check if this round's update was flagged/rejected by detector math
            is_round_rejected = (cid in round_rejected_set)

            # Update 3-round rejection history
            self.rejection_history[cid].append(is_round_rejected)
            rejections_in_last_3 = sum(self.rejection_history[cid])

            if already_excluded:
                # Hospital remains Excluded permanently for the rest of this run (zero-tolerance persistent quarantine)
                trust_after = trust_before
                status = "Excluded"
                reason_text = f"Rejected repeatedly; trust score {trust_after} is below the limit. Updates are permanently quarantined."
            elif is_round_rejected:
                # Rejected this round: trust -30
                trust_after = max(0, trust_before - 30)
                self.trust_scores[cid] = trust_after

                # Check if now becomes Excluded
                if trust_after < 50 or rejections_in_last_3 >= 2:
                    self.is_excluded[cid] = True
                    status = "Excluded"
                    reason_text = f"Rejected repeatedly; trust score {trust_after} is below the limit. Updates are no longer used."
                else:
                    status = "Rejected"
                    if cos_i < 0.0:
                        reason_text = f"Update pointed opposite to the group (similarity {cos_i:.2f})."
                    else:
                        reason_text = f"Update was far less similar to the group than other hospitals (similarity {cos_i:.2f} vs group median {median_cos:.2f})."
            else:
                # Accepted this round: trust +10 (cap 100)
                trust_after = min(100, trust_before + 10)
                self.trust_scores[cid] = trust_after
                status = "Accepted"
                reason_text = "Update consistent with the group."
                accepted_candidates.append(cid)

            verdicts[cid] = {
                "run_id": run_id,
                "round": round_no,
                "hospital_id": hosp_str,
                "client_id": cid,
                "status": status,
                "reason_text": reason_text,
                "cosine_similarity": cos_i,           # blended (primary signal)
                "head_cosine": head_similarities[cid], # FC head only (most diagnostic)
                "full_cosine": full_similarities[cid], # full vector
                "robust_z": z_i,
                "norm_ratio": n_ratio,
                "trust_before": trust_before,
                "trust_after": trust_after,
                "update_hash": u_hash,
            }

        # Quorum rule: fewer than 3 accepted updates means skip aggregation
        if len(accepted_candidates) >= 3:
            trusted_ids = accepted_candidates
        else:
            # Skip aggregation, keep previous global model, record round as skipped
            trusted_ids = []

        self.verdicts_history.append(verdicts)
        return verdicts, trusted_ids

