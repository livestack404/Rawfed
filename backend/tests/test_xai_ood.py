"""Unit tests for OOD guardrails and Grad-CAM explainability:
- Rejection of blank / constant images
- Rejection of saturated color images
- Rejection of extreme aspect ratios
- Generation of Grad-CAM heatmaps
- Hard rejection reasons
"""

import io
import numpy as np
import torch
from PIL import Image
import pytest

from app.fl.model import PneumoniaCNN
from app.xai.ood import OODDetector
from app.xai.gradcam import GradCAM
from app.xai.explain_text import analyze_cam_zones


def test_ood_blank_image_rejection():
    ood = OODDetector()
    # Create all-white blank image
    img = Image.new("L", (100, 100), color=255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    valid, reason, tensor, _ = ood.preprocess_image(buf.getvalue())
    assert valid is False
    assert "blank" in reason.lower() or "contrast" in reason.lower() or "flat" in reason.lower()


def test_ood_color_image_rejection():
    ood = OODDetector()
    # Create highly saturated colored image (red photo)
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    valid, reason, tensor, _ = ood.preprocess_image(buf.getvalue())
    assert valid is False
    assert "color" in reason.lower()


def test_ood_aspect_ratio_rejection():
    ood = OODDetector()
    # Create extreme panoramic image (400 x 50)
    img = Image.new("L", (400, 50), color=128)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    valid, reason, tensor, _ = ood.preprocess_image(buf.getvalue())
    assert valid is False
    assert "aspect" in reason.lower()


def test_ood_min_dimension_rejection():
    ood = OODDetector()
    # Create image smaller than 32px (20 x 20)
    img = Image.new("L", (20, 20), color=128)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    valid, reason, tensor, _ = ood.preprocess_image(buf.getvalue())
    assert valid is False
    assert "small" in reason.lower() or "32" in reason.lower()


def test_gradcam_generation():
    model = PneumoniaCNN(num_classes=2, resolution=64)
    gradcam = GradCAM(model, model.get_last_conv_layer())
    dummy_input = torch.randn(1, 1, 64, 64)

    cam = gradcam.generate_cam(dummy_input, target_class=1)
    assert cam.shape == (64, 64)
    assert cam.min() >= 0.0
    assert cam.max() <= 1.0

    analysis = analyze_cam_zones(cam)
    assert "dominant_zone_key" in analysis
    assert "coverage_pct" in analysis

