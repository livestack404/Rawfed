"""Utilities for weights extraction, serialization, hashing, and vector operations.
Knows ONLY FL mathematics and serialization; completely decoupled from blockchain.
"""

import hashlib
import numpy as np
import torch
import torch.nn as nn
from typing import List

def get_model_weights(model: nn.Module) -> List[np.ndarray]:
    """Extract model parameters as a list of NumPy arrays."""
    return [val.cpu().detach().clone().numpy() for _, val in model.state_dict().items()]

def set_model_weights(model: nn.Module, weights: List[np.ndarray]):
    """Update model state_dict from a list of NumPy arrays."""
    state_dict = model.state_dict()
    for (k, v), w in zip(state_dict.items(), weights):
        state_dict[k] = torch.from_numpy(w).to(v.device)
    model.load_state_dict(state_dict)

def flatten_weights(weights: List[np.ndarray]) -> np.ndarray:
    """Flatten list of parameter arrays into a single 1D NumPy vector."""
    return np.concatenate([w.ravel() for w in weights])

def unflatten_weights(flat: np.ndarray, reference_weights: List[np.ndarray]) -> List[np.ndarray]:
    """Reconstruct list of parameter arrays matching reference shapes."""
    result = []
    idx = 0
    for ref in reference_weights:
        size = ref.size
        part = flat[idx : idx + size].reshape(ref.shape)
        result.append(part)
        idx += size
    return result

def compute_update_hash(update_vector: np.ndarray) -> str:
    """Computes deterministic SHA-256 hex digest of the model update array bytes."""
    data = update_vector.astype(np.float32).tobytes()
    return hashlib.sha256(data).hexdigest()

def cosine_similarity(v1: np.ndarray, v2: np.ndarray, eps: float = 1e-9) -> float:
    """Computes cosine similarity between two 1D vectors."""
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 < eps or norm2 < eps:
        return 0.0
    dot = np.dot(v1, v2)
    sim = dot / (norm1 * norm2)
    return float(np.clip(sim, -1.0, 1.0))

