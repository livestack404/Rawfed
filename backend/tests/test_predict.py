"""
Pytest tests for /api/predict and /api/predict/sample/:id endpoints.

Two mandatory test cases (per the spec):
  1. 503 when no model file is present.
  2. Two different sample images produce different probabilities.
"""

import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app, reload_inference_model
from app import config


client = TestClient(app)


# ---------------------------------------------------------------------------
# Test D-1: POST /api/predict returns 503 when the model checkpoint is missing
# ---------------------------------------------------------------------------

def test_predict_503_without_model_file(monkeypatch):
    """
    When get_selected_final_model returns (None, None) the predict endpoint
    must respond with HTTP 503 and the detail string 'Model not loaded'.
    The test uses monkeypatch so it never touches or deletes the real model.
    """
    monkeypatch.setattr(config, "get_selected_final_model", lambda: (None, None))

    # Flush the in-process model cache so get_inference_model() re-evaluates.
    try:
        reload_inference_model()
    except Exception:
        # Expected: 503 will be raised internally; we just need the cache cleared.
        pass

    dummy = io.BytesIO()
    Image.new("L", (64, 64), color=128).save(dummy, format="PNG")
    dummy.seek(0)

    response = client.post(
        "/api/predict",
        files={"file": ("test.png", dummy.getvalue(), "image/png")},
    )

    assert response.status_code == 503, (
        f"Expected 503 when model is missing, got {response.status_code}"
    )
    detail = response.json().get("detail", "")
    assert "Model not loaded" in detail, (
        f"Expected 'Model not loaded' in detail, got: {detail!r}"
    )

    # Restore the real model for subsequent tests
    monkeypatch.undo()
    try:
        reload_inference_model()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Test D-2: Two different sample images give different softmax probabilities
# ---------------------------------------------------------------------------

def test_two_different_samples_give_different_probabilities():
    """
    POST /api/predict/sample/sample_03  (Normal ground-truth)
    POST /api/predict/sample/sample_02  (Pneumonia ground-truth)

    Both must return status='accepted' and their probability dicts must differ.
    This proves the model is not producing constant outputs.
    """
    r1 = client.post("/api/predict/sample/sample_03")
    r2 = client.post("/api/predict/sample/sample_02")

    assert r1.status_code == 200, f"sample_03 returned {r1.status_code}"
    assert r2.status_code == 200, f"sample_02 returned {r2.status_code}"

    d1 = r1.json()
    d2 = r2.json()

    assert d1.get("status") == "accepted", (
        f"sample_03 was rejected: {d1.get('reason')}"
    )
    assert d2.get("status") == "accepted", (
        f"sample_02 was rejected: {d2.get('reason')}"
    )

    p1 = d1.get("probabilities", {})
    p2 = d2.get("probabilities", {})

    assert p1 != p2, (
        f"Both samples returned identical probabilities: {p1} — "
        "model appears to produce constant output."
    )
