"""Hospital client training implementation.

Runs local PyTorch training iterations on client partition data and computes
the update delta (local_weights - global_weights).
"""

import copy
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Dict, List, Optional, Tuple

from app import config
from app.fl.model import PneumoniaCNN
from app.fl.attack import apply_label_flip, apply_sign_flip
from app.fl.utils import (
    get_model_weights,
    set_model_weights,
    flatten_weights,
)

class HospitalClient:
    def __init__(
        self,
        client_id: int,
        data_loader: DataLoader,
        device: Optional[torch.device] = None,
        conv1_channels: int = 16,
        conv2_channels: int = 32,
        resolution: int = 28,
    ):
        self.client_id = client_id
        self.data_loader = data_loader
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = device

        self.model = PneumoniaCNN(
            num_classes=config.NUM_CLASSES,
            conv1_channels=conv1_channels,
            conv2_channels=conv2_channels,
            resolution=resolution,
        ).to(self.device)

        class_weights = torch.tensor([1.939, 0.674], dtype=torch.float32).to(self.device)
        self.criterion = nn.CrossEntropyLoss(weight=class_weights)

    def train(
        self,
        global_weights: List[np.ndarray],
        epochs: int = config.LOCAL_EPOCHS,
        lr: float = config.LEARNING_RATE,
        is_malicious: bool = False,
        attack_type: str = config.ATTACK_TYPE,
    ) -> Tuple[np.ndarray, int, float]:
        """Performs local client training.

        Args:
            global_weights: Global model parameter arrays.
            epochs: Number of local epochs.
            lr: Learning rate.
            is_malicious: Whether this client is compromised.
            attack_type: "label_flip" or "sign_flip".

        Returns:
            update_delta: 1D flat numpy array (local - global, or poisoned).
            num_samples: Number of training examples used.
            train_loss: Mean training loss.
        """
        # Load global model weights into local model
        set_model_weights(self.model, global_weights)
        flat_global = flatten_weights(global_weights)

        self.model.train()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        total_loss = 0.0
        num_batches = 0
        total_samples = 0

        for _ in range(epochs):
            for images, labels in self.data_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)
                total_samples += len(labels)

                # Label-flip attack during local training
                if is_malicious and attack_type == "label_flip":
                    labels = apply_label_flip(labels, num_classes=config.NUM_CLASSES)

                optimizer.zero_grad()
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                num_batches += 1

        avg_loss = total_loss / max(num_batches, 1)

        # Compute model update: delta = local - global
        flat_local = flatten_weights(get_model_weights(self.model))
        update_delta = flat_local - flat_global

        # Sign-flip attack on the computed update
        if is_malicious and attack_type == "sign_flip":
            update_delta = apply_sign_flip(update_delta, scale=config.SIGN_FLIP_SCALE)

        return update_delta, total_samples, avg_loss

