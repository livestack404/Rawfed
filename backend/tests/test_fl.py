"""Unit tests for Federated Learning components:
- PneumoniaCNN architecture & penultimate feature extraction
- FedAvg aggregation
- Label-flip & sign-flip attack functions
"""

import numpy as np
import torch
import pytest

from app.fl.model import PneumoniaCNN
from app.fl.attack import apply_label_flip, apply_sign_flip
from app.fl.server import FLServer
from app.fl.utils import get_model_weights, flatten_weights

def test_model_forward_and_feature_extraction():
    model = PneumoniaCNN(num_classes=2)
    x = torch.randn(4, 1, 28, 28)

    # Test forward output shape
    out = model(x)
    assert out.shape == (4, 2)

    # Test penultimate feature extraction shape (64 dimensions)
    feats = model.extract_features(x)
    assert feats.shape == (4, 64)

    # Verify last conv layer exists
    last_conv = model.get_last_conv_layer()
    assert isinstance(last_conv, torch.nn.Conv2d)
    assert last_conv.out_channels == 32

def test_label_flip_attack():
    labels = torch.tensor([0, 1, 0, 1, 1, 0])
    flipped = apply_label_flip(labels, num_classes=2)
    expected = torch.tensor([1, 0, 1, 0, 0, 1])
    assert torch.equal(flipped, expected)

def test_sign_flip_attack():
    delta = np.array([0.1, -0.2, 0.5])
    poisoned = apply_sign_flip(delta, scale=3.0)
    expected = np.array([-0.3, 0.6, -1.5])
    assert np.allclose(poisoned, expected)

def test_fedavg_aggregation():
    server = FLServer()
    initial_weights = server.get_global_weights()
    flat_init = flatten_weights(initial_weights)

    # Two updates of same size, 100 samples each
    delta1 = np.ones_like(flat_init) * 0.1
    delta2 = np.ones_like(flat_init) * 0.3

    trusted = [
        (delta1, 100),
        (delta2, 100),
    ]

    new_weights = server.aggregate(trusted)
    flat_new = flatten_weights(new_weights)

    # Weighted avg delta should be (0.1 + 0.3) / 2 = 0.2
    assert np.allclose(flat_new - flat_init, 0.2, atol=1e-5)

