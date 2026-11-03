"""PyTorch Grad-CAM implementation for PneumoniaCNN.

Generates localized class activation heatmaps overlayable on chest radiographs.
"""

import base64
import io
import matplotlib.cm as cm
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from typing import Tuple

class GradCAM:
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate_cam(
        self,
        input_tensor: torch.Tensor,
        target_class: int = 1,
    ) -> np.ndarray:
        """Computes 28x28 normalized Grad-CAM activation map.

        Returns:
            cam_28x28: 2D numpy array [0.0 .. 1.0] of shape (28, 28)
        """
        self.model.eval()
        self.model.zero_grad()

        input_tensor = input_tensor.clone().requires_grad_(True)
        output = self.model(input_tensor)

        score = output[0, target_class]
        score.backward()

        # Channel-wise mean of gradients
        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)  # (1, 32, 1, 1)
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)  # (1, 1, H, W)
        cam = F.relu(cam)

        # Upsample to match input tensor resolution
        h, w = input_tensor.shape[-2], input_tensor.shape[-1]
        cam = F.interpolate(cam, size=(h, w), mode="bilinear", align_corners=False)
        cam_np = cam.squeeze().cpu().numpy()

        # Min-max normalization
        cam_min, cam_max = cam_np.min(), cam_np.max()
        if cam_max - cam_min > 1e-6:
            cam_np = (cam_np - cam_min) / (cam_max - cam_min)
        else:
            cam_np = np.zeros_like(cam_np)

        return cam_np.astype(np.float32)

    @staticmethod
    def overlay_heatmap(
        cam: np.ndarray,
        base_img: Image.Image,
        alpha: float = 0.5,
        colormap: str = "jet",
    ) -> str:
        """Overlays heatmap on base PIL image and returns Base64 PNG data URL."""
        # Upsample base image and CAM for smooth visual display (e.g. 224x224)
        display_size = (224, 224)
        base_resized = base_img.convert("RGB").resize(display_size, Image.Resampling.BILINEAR)
        base_arr = np.array(base_resized).astype(np.float32) / 255.0

        cam_pil = Image.fromarray((cam * 255).astype(np.uint8)).resize(
            display_size, Image.Resampling.BILINEAR
        )
        cam_upsampled = np.array(cam_pil).astype(np.float32) / 255.0

        # Apply colormap
        import matplotlib as mpl
        cmap = mpl.colormaps[colormap]
        heatmap_rgba = cmap(cam_upsampled)[:, :, :3]

        # Blend
        blended = (1.0 - alpha) * base_arr + alpha * heatmap_rgba
        blended = np.clip(blended * 255, 0, 255).astype(np.uint8)

        # Convert to base64 PNG
        out_pil = Image.fromarray(blended)
        buf = io.BytesIO()
        out_pil.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

