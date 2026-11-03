"""Guardrail verification for chest radiographs.

Hard reject checks:
1. Undecodable file
2. Minimum dimension: either side < 32 px
3. Aspect ratio: width / height > 2.5 or < 0.4
4. Flat or blank: grayscale std < 8 (on 0..255 scale)
5. Strongly colored: mean channel difference > 20 of 255
"""

import io
import numpy as np
import torch
from PIL import Image
from typing import Optional, Tuple


class OODDetector:
    def preprocess_image(
        self,
        file_bytes: bytes,
        target_resolution: int = 64,
    ) -> Tuple[bool, Optional[str], Optional[torch.Tensor], Optional[Image.Image]]:
        """Validates format, aspect ratio, color content, and converts to grayscale tensor."""
        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
        except Exception:
            return False, "File is not a valid decodable image file.", None, None

        w, h = pil_img.size
        # Minimum dimension check (< 32 px on either side)
        if w < 32 or h < 32:
            return False, f"Image dimensions too small ({w}x{h}). Minimum size is 32px on both sides.", None, None

        # Aspect ratio check
        aspect = w / max(h, 1)
        if aspect < 0.4 or aspect > 2.5:
            return False, f"Extreme aspect ratio ({aspect:.2f}). Must be between 0.4 and 2.5.", None, None

        # Check for strongly colored images (mean channel difference > 20 of 255)
        if pil_img.mode in ("RGB", "RGBA"):
            rgb_arr = np.array(pil_img.convert("RGB"), dtype=np.float32)
            r, g, b = rgb_arr[:, :, 0], rgb_arr[:, :, 1], rgb_arr[:, :, 2]
            mean_channel_diff = (
                np.mean(np.abs(r - g)) + np.mean(np.abs(g - b)) + np.mean(np.abs(r - b))
            ) / 3.0
            if mean_channel_diff > 20.0:
                return False, f"Image is strongly colored (channel divergence {mean_channel_diff:.1f} > 20). Chest radiographs must be grayscale.", None, None

        # Convert to grayscale
        gray_img = pil_img.convert("L")
        arr = np.array(gray_img, dtype=np.float32)

        # Blank or low-contrast check (grayscale std < 8)
        std_val = float(np.std(arr))
        if std_val < 8.0:
            return False, f"Image is flat or blank (grayscale standard deviation {std_val:.2f} < 8.0).", None, None

        # Resize to target resolution matching the model
        resized_pil = gray_img.resize((target_resolution, target_resolution), Image.Resampling.BILINEAR)
        # Preprocessing identical to training: grayscale, ToTensor, Normalize(0.5, 0.5)
        norm_arr = (np.array(resized_pil, dtype=np.float32) / 255.0 - 0.5) / 0.5
        tensor = torch.from_numpy(norm_arr).unsqueeze(0).unsqueeze(0)  # (1, 1, res, res)

        return True, None, tensor, gray_img


ood_detector = OODDetector()

