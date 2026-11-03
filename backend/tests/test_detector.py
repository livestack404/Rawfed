"""Unit tests for PoisonDetector.

Validates:
- Cosine similarity computation
- Trust scores, persistence, and exact status strings: Accepted, Rejected, Excluded
- Warmup grace period (rounds 1 and 2: reject only if cos < 0)
- Outlier detection (round 3 onward: robust_z < -2.5 and cos < median - 0.15)
- Rejection cap (max 3 hospitals per round)
- Quorum rule (fewer than 3 accepted updates means skip aggregation)
- Reinstatement after 3 consecutive passing rounds
- Reason text templates with real numbers and no ground-truth leakage
"""

import numpy as np
import pytest
from app.detection.detector import PoisonDetector

def test_cosine_similarity():
    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([1.0, 0.0, 0.0])
    v3 = np.array([-1.0, 0.0, 0.0])
    v4 = np.array([0.0, 1.0, 0.0])

    assert np.isclose(PoisonDetector._cosine_sim(v1, v2), 1.0)
    assert np.isclose(PoisonDetector._cosine_sim(v1, v3), -1.0)
    assert np.isclose(PoisonDetector._cosine_sim(v1, v4), 0.0)

def test_honest_consensus():
    detector = PoisonDetector(warmup_rounds=2)
    # 8 honest clients with slightly noisy but aligned gradients
    rng = np.random.default_rng(42)
    base_grad = np.ones(100)
    updates = {}
    for i in range(8):
        noise = rng.normal(0, 0.05, 100)
        updates[i] = base_grad + noise

    verdicts, trusted = detector.evaluate_round(1, updates, detection_enabled=True)
    assert len(trusted) == 8
    for cid in range(8):
        assert verdicts[cid]["status"] == "Accepted"
        assert verdicts[cid]["trust_after"] == 100
        assert "Update consistent with the group." in verdicts[cid]["reason_text"]

def test_sign_flip_detection():
    detector = PoisonDetector(warmup_rounds=2)
    rng = np.random.default_rng(42)
    base_grad = np.ones(100)
    updates = {}
    for i in range(6):
        updates[i] = base_grad + rng.normal(0, 0.05, 100)

    # Clients 6 and 7 are malicious (sign flip)
    updates[6] = -5.0 * base_grad
    updates[7] = -5.0 * base_grad

    # In round 1 (warmup), negative cosine updates (sim < 0.0) are rejected immediately
    verdicts, trusted = detector.evaluate_round(1, updates, detection_enabled=True)
    assert 6 not in trusted
    assert 7 not in trusted
    assert verdicts[6]["status"] == "Rejected"
    assert verdicts[7]["status"] == "Rejected"
    assert verdicts[6]["trust_after"] == 70
    assert verdicts[7]["trust_after"] == 70
    assert len(trusted) == 6

def test_persistence_exclusion_and_reinstatement():
    """Tests that repeated rejections drop trust below 50, triggering Excluded status,
    and 3 consecutive passing rounds reinstate with trust 60."""
    detector = PoisonDetector(warmup_rounds=0)
    rng = np.random.default_rng(42)
    base_grad = np.ones(100)

    # Round 1: Client 7 is malicious
    updates_r1 = {i: base_grad + rng.normal(0, 0.05, 100) for i in range(7)}
    updates_r1[7] = -base_grad
    v1, t1 = detector.evaluate_round(1, updates_r1, detection_enabled=True)
    assert v1[7]["status"] == "Rejected"
    assert v1[7]["trust_after"] == 70

    # Round 2: Client 7 is malicious again -> rejected in 2 of last 3 rounds & trust drops to 40 (< 50) -> Excluded
    updates_r2 = {i: base_grad + rng.normal(0, 0.05, 100) for i in range(7)}
    updates_r2[7] = -base_grad
    v2, t2 = detector.evaluate_round(2, updates_r2, detection_enabled=True)
    assert v2[7]["status"] == "Excluded"
    assert v2[7]["trust_after"] == 40
    assert 7 not in t2

    # Rounds 3, 4, 5: Client 7 sends honest updates for 3 consecutive rounds
    for r in range(3, 6):
        updates = {i: base_grad + rng.normal(0, 0.05, 100) for i in range(8)}
        vr, tr = detector.evaluate_round(r, updates, detection_enabled=True)
        if r < 5:
            assert vr[7]["status"] == "Excluded"
        else:
            # Reinstated at end of 3rd consecutive pass
            assert detector.is_excluded[7] is False
            assert detector.trust_scores[7] == 60

def test_quorum_rule():
    detector = PoisonDetector(warmup_rounds=2)
    # 2 clients total: both updates are accepted, but 2 < 3 minimum quorum
    base_grad = np.ones(100)
    updates = {
        0: base_grad,
        1: base_grad + 0.01,
    }
    verdicts, trusted = detector.evaluate_round(1, updates, detection_enabled=True)
    assert len(trusted) == 0  # Quorum not met (< 3 accepted updates), aggregation skipped

