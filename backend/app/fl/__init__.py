# fl module exports
from app.fl.model import PneumoniaCNN
from app.fl.client import HospitalClient
from app.fl.server import FLServer
from app.fl.attack import apply_label_flip, apply_sign_flip
from app.fl.utils import (
    get_model_weights,
    set_model_weights,
    flatten_weights,
    unflatten_weights,
    compute_update_hash,
    cosine_similarity,
)

__all__ = [
    "PneumoniaCNN",
    "HospitalClient",
    "FLServer",
    "apply_label_flip",
    "apply_sign_flip",
    "get_model_weights",
    "set_model_weights",
    "flatten_weights",
    "unflatten_weights",
    "compute_update_hash",
    "cosine_similarity",
]

