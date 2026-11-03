"""Integration tests for FastAPI endpoints."""

import io
from pathlib import Path
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app, reload_inference_model
from app import config

client = TestClient(app)


def test_api_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "blockchain_mode" in data


def test_api_config():
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "scenarios" in data
    assert "clean" in data["scenarios"]
    assert "attacked" in data["scenarios"]
    assert "defended" in data["scenarios"]


def test_api_samples():
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) == 15
    assert all("id" in s and "image_data_url" in s for s in samples)


def test_api_samples_download():
    response = client.get("/api/samples/download")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert len(response.content) > 0


def test_api_model_info():
    response = client.get("/api/model-info")
    assert response.status_code == 200
    meta = response.json()
    assert "resolution" in meta
    assert "test_accuracy" in meta
    assert "sensitivity" in meta


def test_api_predict_sample_invalid():
    # Calling predict on invalid sample should return rejected status
    response = client.post("/api/predict/sample/invalid")
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "rejected"
    assert res["is_ood"] is True


def test_smoke_trained_model_different_probabilities():
    """Verify smoke-trained model loads and two different sample images give different probabilities."""
    res1 = client.post("/api/predict/sample/sample_03")
    res2 = client.post("/api/predict/sample/sample_02")
    assert res1.status_code == 200
    assert res2.status_code == 200
    p1 = res1.json()
    p2 = res2.json()
    assert p1["status"] == "accepted"
    assert p2["status"] == "accepted"
    # Soft uncertainty flag is present
    assert "uncertain" in p1
    assert "caption" in p1
    # Different probabilities on different sample images
    assert p1["probabilities"] != p2["probabilities"]


def test_predict_returns_503_when_model_removed(monkeypatch):
    """Verify with the model file removed/missing, /api/predict returns 503 'Model not loaded'."""
    monkeypatch.setattr(config, "get_selected_final_model", lambda: (None, None))
    # Invalidate cache
    try:
        reload_inference_model()
    except Exception:
        pass

    dummy_bytes = io.BytesIO()
    Image.new("L", (64, 64), color=128).save(dummy_bytes, format="PNG")
    dummy_bytes.seek(0)

    res = client.post("/api/predict", files={"file": ("test.png", dummy_bytes.getvalue(), "image/png")})
    assert res.status_code == 503
    assert "Model not loaded" in res.json().get("detail", "")

    # Restore cache for subsequent tests
    monkeypatch.undo()
    reload_inference_model()


def test_api_ledger_flow():
    # Verify ledger query
    res = client.get("/api/ledger")
    assert res.status_code == 200
    assert "entries" in res.json()

    # Verify integrity endpoint
    verify_res = client.get("/api/ledger/verify")
    assert verify_res.status_code == 200
    assert "valid" in verify_res.json()

