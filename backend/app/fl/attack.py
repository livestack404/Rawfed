"""Poisoning attack implementations for Federated Learning.

Supports:
1. Label-flip attack: flips labels during local training (0 <-> 1).
2. Sign-flip attack: inverts and scales the client's computed model update vector.
"""

import numpy as np
import torch
from typing import Tuple

def apply_label_flip(labels: torch.Tensor, num_classes: int = 2) -> torch.Tensor:
    """Inverts binary classification labels (0 -> 1, 1 -> 0)."""
    return (num_classes - 1) - labels

def apply_sign_flip(update_vector: np.ndarray, scale: float = 5.0) -> np.ndarray:
    """Inverts update direction to push global model weights in opposite direction."""
    return -scale * update_vector

