"""FastAPI Application Server for Federated Healthcare Security.

Exposes REST and WebSocket endpoints for:
- Orchestrating federated learning simulations (Start, Pause, Resume, Stop, Reset)
- Real-time event streaming via WebSocket (/ws)
- Poisoning attack detection & metric inspection
- Blockchain & Mock Ledger audit log queries, tamper demonstration, and integrity checks
- Clinical Chest X-ray inference with OOD rejection guardrails & Grad-CAM explainability
- Comparative scenario analytics (Clean vs. Attacked vs. Defended)
"""

import asyncio
import base64
import io
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    UploadFile,
    File,
    Query,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
import zipfile
from PIL import Image
import torch
import torch.nn.functional as F
import numpy as np

from app import config
from app.config import RunConfig, SCENARIOS
from app.state import training_state
from app.orchestrator import orchestrator
from app.fl.model import PneumoniaCNN
from app.xai.ood import ood_detector
from app.xai.gradcam import GradCAM

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api")

app = FastAPI(
    title="Federated Healthcare Security API",
    description="Zero-Trust Poisoning Defense & Blockchain Audit Logger for Healthcare Federated Learning",
    version="2.0.0",
)

# Enable CORS for Next.js and frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global Model Cache for Fast Clinical Inference
# ---------------------------------------------------------------------------
_inference_model: Optional[PneumoniaCNN] = None
_inference_meta: Optional[Dict] = None
_inference_model_path: Optional[Path] = None


def get_inference_model() -> Tuple[PneumoniaCNN, Dict]:
    """Loads the model checkpoint into memory for inference. Fails with 503 if missing."""
    global _inference_model, _inference_meta, _inference_model_path
    model_path, meta = config.get_selected_final_model()
    if model_path is None or not model_path.exists():
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )

    if _inference_model is None or _inference_model_path != model_path:
        try:
            resolution = meta.get("resolution", 64) if meta else 64
            model = PneumoniaCNN(num_classes=config.NUM_CLASSES, resolution=resolution)
            state_dict = torch.load(model_path, map_location="cpu")
            model.load_state_dict(state_dict)
            model.eval()
            _inference_model = model
            _inference_meta = meta
            _inference_model_path = model_path
            logger.info(f"Loaded model checkpoint from {model_path} (resolution {resolution})")
        except Exception as e:
            logger.error(f"Failed to load checkpoint ({e})")
            raise HTTPException(
                status_code=503,
                detail="Model not loaded"
            )

    return _inference_model, _inference_meta


def reload_inference_model():
    """Forces reloading checkpoint after a new training run."""
    global _inference_model, _inference_meta, _inference_model_path
    _inference_model = None
    _inference_meta = None
    _inference_model_path = None
    return get_inference_model()


# ---------------------------------------------------------------------------
# WebSocket Endpoint for Live Event Streaming
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Streams live federated training events, node statuses, detection verdicts, and blocks."""
    await training_state.connect_ws(websocket)
    # Send immediate initial status sync
    await websocket.send_json({
        "type": "init",
        "data": {
            "is_running": training_state.is_running,
            "is_paused": training_state.is_paused,
            "current_round": training_state.current_round,
            "total_rounds": training_state.total_rounds,
            "current_scenario": training_state.current_scenario,
            "blockchain_mode": orchestrator.blockchain.mode,
        },
    })
    try:
        while True:
            # Keep connection alive and accept incoming ping/commands
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                cmd = msg.get("command")
                if cmd == "pause":
                    training_state.pause()
                elif cmd == "resume":
                    training_state.resume()
                elif cmd == "stop":
                    training_state.stop()
            except Exception:
                pass
    except WebSocketDisconnect:
        training_state.disconnect_ws(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        training_state.disconnect_ws(websocket)


# ---------------------------------------------------------------------------
# Training Orchestration Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/start")
async def start_training(run_cfg: RunConfig):
    """Starts a federated training simulation in the background."""
    if training_state.is_running:
        raise HTTPException(
            status_code=400,
            detail="A simulation run is already in progress. Stop or reset it first.",
        )

    # Launch background simulation task
    asyncio.create_task(orchestrator.run_simulation(run_cfg))
    return {
        "status": "started",
        "scenario": run_cfg.scenario,
        "rounds": run_cfg.rounds,
        "num_clients": run_cfg.num_clients,
        "detection": run_cfg.detection,
        "attack_type": run_cfg.attack_type,
    }


@app.post("/api/pause")
async def pause_training():
    """Pauses the currently running simulation."""
    if not training_state.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running.")
    training_state.pause()
    return {"status": "paused", "current_round": training_state.current_round}


@app.post("/api/resume")
async def resume_training():
    """Resumes a paused simulation."""
    if not training_state.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running.")
    training_state.resume()
    return {"status": "resumed", "current_round": training_state.current_round}


@app.post("/api/step")
async def step_training():
    """Advances one phase while paused."""
    if not training_state.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running.")
    training_state.step()
    return {"status": "stepping", "current_round": training_state.current_round}


@app.post("/api/stop")
async def stop_training():
    """Stops the currently running simulation."""
    training_state.stop()
    return {"status": "stopped"}


@app.post("/api/reset")
async def reset_training():
    """Resets orchestrator state, detector history, and in-memory events."""
    training_state.reset()
    orchestrator.detector.reset()
    return {"status": "reset"}


@app.get("/api/status")
async def get_status():
    """Returns current runtime state of orchestrator and training."""
    best_meta_file = config.CHECKPOINTS_DIR / "best_model_meta.json"
    best_meta = {}
    if best_meta_file.exists():
        try:
            with open(best_meta_file, "r") as f:
                best_meta = json.load(f)
        except Exception:
            pass

    return {
        "is_running": training_state.is_running,
        "is_paused": training_state.is_paused,
        "current_round": training_state.current_round,
        "total_rounds": training_state.total_rounds,
        "current_scenario": training_state.current_scenario,
        "active_config": training_state.active_config,
        "active_ws_count": len(training_state.active_websockets),
        "blockchain_mode": orchestrator.blockchain.mode,
        "total_ledger_entries": len(orchestrator.blockchain.get_entries()),
        "best_model": best_meta,
    }


@app.get("/api/config")
async def get_config():
    """Returns preset scenarios and system hyperparameters."""
    return {
        "scenarios": SCENARIOS,
        "defaults": {
            "num_clients": config.NUM_CLIENTS,
            "rounds": config.NUM_ROUNDS,
            "batch_size": config.BATCH_SIZE,
            "learning_rate": config.LEARNING_RATE,
            "mad_threshold": config.MAD_THRESHOLD,
            "persistence_k": config.PERSISTENCE_K,
            "persistence_m": config.PERSISTENCE_M,
            "warmup_rounds": config.WARMUP_ROUNDS,
            "default_malicious_clients": config.DEFAULT_MALICIOUS_CLIENTS,
        },
    }


# ---------------------------------------------------------------------------
# Blockchain & Mock Ledger Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/ledger")
async def get_ledger(limit: Optional[int] = Query(None, ge=1, le=1000)):
    """Returns audit log entries from the blockchain or cryptographic mock ledger."""
    entries = orchestrator.blockchain.get_entries(limit=limit)
    return {
        "mode": orchestrator.blockchain.mode,
        "total": len(entries),
        "entries": entries,
    }


@app.get("/api/ledger/verify")
async def verify_ledger():
    """Cryptographically verifies the entire SHA-256 block hash chain."""
    return orchestrator.blockchain.verify_integrity()


@app.post("/api/ledger/tamper")
async def tamper_ledger(index: int = Query(0, ge=0)):
    """Demonstrates tamper detection by editing the local record copy only."""
    result = orchestrator.blockchain.tamper_attempt(index=index)
    return result


@app.post("/api/ledger/restore")
async def restore_ledger():
    """Reverts any tampered local records back to the blockchain-verified original."""
    result = orchestrator.blockchain.restore_attempt()
    return result


@app.post("/api/ledger/reset")
async def reset_ledger():
    """Clears all ledger entries from memory and disk."""
    orchestrator.blockchain.reset()
    return {"status": "ledger_reset"}


# ---------------------------------------------------------------------------
# Clinical Inference & XAI Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/model-info")
async def get_model_info():
    """Returns the meta JSON of the active trained final model."""
    _, meta = get_inference_model()
    if meta is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return meta


@app.get("/api/samples")
async def get_sample_images():
    """Returns the 16 test sample images from samples/manifest.json with image data URLs."""
    manifest_path = config.SAMPLES_MANIFEST_PATH
    if not manifest_path.exists():
        # Fallback to empty if not exported
        return []

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception:
        return []

    results = []
    for s in manifest:
        filename = s.get("filename", "")
        img_path = config.SAMPLES_DIR / filename
        if not img_path.exists():
            continue
        data_url = None
        try:
            with open(img_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
                data_url = f"data:image/png;base64,{b64}"
        except Exception:
            pass
        results.append({
            "id": s.get("id", filename),
            "filename": filename,
            "label": s.get("label", ""),
            "label_idx": s.get("label_idx", 0),
            "image_url": data_url,
            "image_data_url": data_url,
        })
    return results


@app.get("/api/samples/download")
@app.get("/api/samples/zip")
async def download_samples_zip():
    """Returns a ZIP archive of all 16 sample images and the manifest.json."""
    if not config.SAMPLES_DIR.exists():
        raise HTTPException(status_code=404, detail="Samples directory not found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in config.SAMPLES_DIR.iterdir():
            if p.is_file():
                zf.write(p, arcname=p.name)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="anti-flearning-samples.zip"'},
    )


@app.post("/api/predict")
async def predict_image(file: UploadFile = File(...)):
    """Runs input guardrails, PneumoniaCNN classification, and Grad-CAM generation."""
    contents = await file.read()
    return _process_prediction(contents)


@app.post("/api/predict/sample/{sample_id}")
async def predict_preset_sample(sample_id: str):
    """Runs inference directly on a sample image, returning prediction and true label from manifest."""
    target_path = None
    manifest_item = None

    if config.SAMPLES_MANIFEST_PATH.exists():
        try:
            with open(config.SAMPLES_MANIFEST_PATH, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            for item in manifest:
                if (
                    item.get("id") == sample_id
                    or item.get("filename") == sample_id
                    or item.get("filename") == f"{sample_id}.png"
                ):
                    manifest_item = item
                    target_path = config.SAMPLES_DIR / item["filename"]
                    break
        except Exception:
            pass

    if target_path is None or not target_path.exists():
        candidate = config.SAMPLES_DIR / (sample_id if sample_id.endswith(".png") else f"{sample_id}.png")
        if candidate.exists():
            target_path = candidate
        else:
            legacy_map = {
                "normal": "normal_sample.png",
                "pneumonia": "pneumonia_sample.png",
                "invalid": "invalid_sample.png",
            }
            if sample_id in legacy_map:
                target_path = config.SAMPLE_IMAGES_DIR / legacy_map[sample_id]

    if target_path is None or not target_path.exists():
        raise HTTPException(status_code=404, detail="Sample not found.")

    with open(target_path, "rb") as f:
        contents = f.read()

    result = _process_prediction(contents)
    if manifest_item is not None:
        result["sample_id"] = manifest_item.get("id")
        result["filename"] = manifest_item.get("filename")
        result["true_label"] = manifest_item.get("label")
        result["true_label_idx"] = manifest_item.get("label_idx")
        if result.get("status") == "accepted":
            result["is_match"] = bool(result.get("prediction") == manifest_item.get("label"))

    return result


def _process_prediction(image_bytes: bytes) -> Dict:
    """Core prediction pipeline with hard reject guardrails and soft uncertainty."""
    model, meta = get_inference_model()
    resolution = meta.get("resolution", 64) if meta else 64

    # Hard rejects only: undecodable, either side < 32 px, aspect ratio > 2.5 or < 0.4,
    # flat/blank (grayscale std < 8), strongly colored (mean channel diff > 20 of 255)
    valid, error_msg, tensor, gray_img = ood_detector.preprocess_image(
        image_bytes, target_resolution=resolution
    )
    if not valid:
        return {
            "status": "rejected",
            "is_ood": True,
            "reason": error_msg,
            "disclaimer": "Decision support only, not a medical diagnosis.",
        }

    model.eval()
    with torch.no_grad():
        logits = model(tensor)
        probs = F.softmax(logits, dim=1).squeeze().cpu().numpy()

    pred_class = int(np.argmax(probs))
    confidence = float(probs[pred_class])
    label = "Pneumonia" if pred_class == 1 else "Normal"
    # Soft: max probability < 0.70 returns an uncertain: true flag; the result is still returned
    uncertain = bool(confidence < 0.70)

    heatmap_b64 = None
    if config.XAI_ENABLED:
        try:
            gradcam = GradCAM(model, model.get_last_conv_layer())
            cam = gradcam.generate_cam(tensor, target_class=pred_class)
            heatmap_b64 = gradcam.overlay_heatmap(cam, gray_img, alpha=0.5)
        except Exception as e:
            logger.warning(f"Grad-CAM generation failed: {e}")

    # Static caption for explainability overlay. The response carries no per-image explanation text.
    # The UI shows one static caption: "Highlighted areas show where the model focused most."
    caption = "Highlighted areas show where the model focused most."

    return {
        "status": "accepted",
        "is_ood": False,
        "prediction": label,
        "predicted_class": pred_class,
        "confidence": round(confidence, 4),
        "confidence_percentage": round(confidence * 100, 1),
        "probabilities": {
            "normal": round(float(probs[0]), 4),
            "pneumonia": round(float(probs[1]), 4),
        },
        "uncertain": uncertain,
        "heatmap_data_url": heatmap_b64,
        "caption": caption,
        "disclaimer": "Decision support only, not a medical diagnosis.",
    }


# ---------------------------------------------------------------------------
# Results & Comparative Analytics Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/results")
async def get_results_summary():
    """Aggregates round metrics across Clean, Attacked, and Defended scenarios for comparison charts."""
    scenarios = ["clean", "attacked", "defended"]
    results_by_scenario = {}

    for sc in scenarios:
        sc_dir = config.RESULTS_DIR / sc
        metrics_file = sc_dir / "metrics.json"
        if metrics_file.exists():
            try:
                with open(metrics_file, "r") as f:
                    results_by_scenario[sc] = json.load(f)
            except Exception:
                results_by_scenario[sc] = None
        else:
            results_by_scenario[sc] = None

    return {
        "scenarios": results_by_scenario,
        "available_scenarios": [k for k, v in results_by_scenario.items() if v is not None],
    }


@app.get("/api/results/{scenario}/csv")
async def get_scenario_csv(scenario: str):
    """Downloads per-round metrics as a CSV file."""
    csv_file = config.RESULTS_DIR / scenario / "round_metrics.csv"
    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="Metrics CSV not found for this scenario.")
    return FileResponse(
        csv_file,
        media_type="text/csv",
        filename=f"{scenario}_metrics.csv",
    )


@app.get("/api/results/{scenario}/replay")
async def get_scenario_replay(scenario: str):
    """Fetches full event sequence for frontend replay mode."""
    log_file = config.RESULTS_DIR / scenario / "event_log.json"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="Event log not found for this scenario.")
    with open(log_file, "r") as f:
        events = json.load(f)
    return {"scenario": scenario, "total_events": len(events), "events": events}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

