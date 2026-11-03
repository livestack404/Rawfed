"""Explainability analysis utilities for Grad-CAM activation maps."""

import numpy as np
from typing import Dict


def analyze_cam_zones(cam: np.ndarray, threshold: float = 0.35) -> Dict:
    """Partitions CAM into anatomical lung zones and analyzes activation patterns."""
    h, w = cam.shape
    row_splits = [0, int(h * 0.33), int(h * 0.67), h]
    col_split = int(w * 0.5)

    zones = {
        "upper_right": cam[0:row_splits[1], 0:col_split],
        "upper_left": cam[0:row_splits[1], col_split:w],
        "middle_right": cam[row_splits[1]:row_splits[2], 0:col_split],
        "middle_left": cam[row_splits[1]:row_splits[2], col_split:w],
        "lower_right": cam[row_splits[2]:h, 0:col_split],
        "lower_left": cam[row_splits[2]:h, col_split:w],
    }

    zone_stats = {}
    for name, patch in zones.items():
        mean_val = float(np.mean(patch)) if patch.size > 0 else 0.0
        max_val = float(np.max(patch)) if patch.size > 0 else 0.0
        zone_stats[name] = {"mean": mean_val, "max": max_val}

    dominant_zone_key = max(zone_stats.keys(), key=lambda k: zone_stats[k]["mean"])
    max_intensity = float(np.max(cam)) if cam.size > 0 else 0.0
    active_pixels = int(np.sum(cam >= threshold))
    coverage_pct = round((active_pixels / max(cam.size, 1)) * 100.0, 1)

    return {
        "dominant_zone_key": dominant_zone_key,
        "max_intensity": round(max_intensity, 3),
        "coverage_pct": coverage_pct,
        "zone_stats": zone_stats,
    }

