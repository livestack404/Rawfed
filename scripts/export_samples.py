"""Export 16 test images (8 Normal, 8 Pneumonia) with fixed seed 42 to samples/.

Saved as PNG files at the resolution of the selected final model (defaults from meta, 128 now)
with samples/manifest.json. Leaves old sample_images/ folder untouched.
"""

import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLES_DIR = BASE_DIR / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_DIR = BASE_DIR / 'backend'
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

from backend.app.config import get_selected_final_model
from backend.app.data.loader import load_medmnist_raw


def get_default_resolution() -> int:
    try:
        _, meta = get_selected_final_model()
        if meta and "resolution" in meta:
            return int(meta["resolution"])
    except Exception as e:
        print(f"Warning: could not read model meta resolution ({e}), defaulting to 128")
    return 128


def export_samples(seed: int = 42, resolution: int = None):
    if resolution is None:
        resolution = get_default_resolution()
    print(f"Loading test split at resolution {resolution}x{resolution}...")
    _, _, (test_imgs, test_lbls) = load_medmnist_raw(size=resolution)
    labels = test_lbls.squeeze()

    rng = np.random.default_rng(seed)
    normal_indices = np.where(labels == 0)[0]
    pneumonia_indices = np.where(labels == 1)[0]

    chosen_normal = rng.choice(normal_indices, size=8, replace=False)
    chosen_pneumonia = rng.choice(pneumonia_indices, size=8, replace=False)

    # Interleave 8 Normal and 8 Pneumonia for balanced 4x4 gallery
    combined_indices = []
    for norm_idx, pneu_idx in zip(chosen_normal, chosen_pneumonia):
        combined_indices.append(norm_idx)
        combined_indices.append(pneu_idx)

    manifest = []
    for i, idx in enumerate(combined_indices):
        img_arr = test_imgs[idx]
        lbl = int(labels[idx])
        label_str = "Normal" if lbl == 0 else "Pneumonia"
        filename = f"sample_{i + 1:02d}.png"
        file_path = SAMPLES_DIR / filename

        # Save grayscale PNG
        img = Image.fromarray(img_arr, mode="L")
        img.save(file_path, format="PNG")

        manifest.append({
            "id": f"sample_{i + 1:02d}",
            "filename": filename,
            "label": label_str,
            "label_idx": lbl,
            "resolution": resolution,
        })
        print(f"  Exported {filename}: {label_str} (test index {idx}, {resolution}x{resolution})")

    manifest_path = SAMPLES_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nSuccessfully exported 16 sample images and manifest to {SAMPLES_DIR} at {resolution}x{resolution}")
    return manifest


if __name__ == "__main__":
    export_samples()
