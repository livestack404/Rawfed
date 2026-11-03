"""Federated Learning Server with FedAvg aggregation and comprehensive test evaluation.
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Dict, List, Optional, Tuple
from sklearn.metrics import (
    precision_recall_fscore_support,
    balanced_accuracy_score,
    roc_auc_score,
    confusion_matrix,
)

from app import config
from app.fl.model import PneumoniaCNN
from app.fl.utils import (
    get_model_weights,
    set_model_weights,
    flatten_weights,
    unflatten_weights,
)

class FLServer:
    def __init__(
        self,
        device: Optional[torch.device] = None,
        conv1_channels: int = 16,
        conv2_channels: int = 32,
        resolution: int = 28,
    ):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = device
            
        self.global_model = PneumoniaCNN(
            num_classes=config.NUM_CLASSES,
            conv1_channels=conv1_channels,
            conv2_channels=conv2_channels,
            resolution=resolution,
        ).to(self.device)
        
        # Class weights for PneumoniaMNIST (~26% normal, ~74% pneumonia)
        class_weights = torch.tensor([1.939, 0.674], dtype=torch.float32).to(self.device)
        self.criterion = nn.CrossEntropyLoss(weight=class_weights)

    def get_global_weights(self) -> List[np.ndarray]:
        """Returns the current global model weights."""
        return get_model_weights(self.global_model)

    def set_global_weights(self, weights: List[np.ndarray]):
        """Sets the global model weights."""
        set_model_weights(self.global_model, weights)

    def aggregate(
        self,
        trusted_client_updates: List[Tuple[np.ndarray, int]],
    ) -> List[np.ndarray]:
        """Performs FedAvg aggregation over accepted client updates.

        Args:
            trusted_client_updates: List of (update_delta_vector, sample_count) tuples.

        Returns:
            new_global_weights: Updated list of parameter arrays.
        """
        if not trusted_client_updates:
            # If all updates were excluded (rare edge case), maintain current weights
            return self.get_global_weights()

        current_weights = self.get_global_weights()
        flat_current = flatten_weights(current_weights)

        total_samples = sum(count for _, count in trusted_client_updates)
        weighted_delta = np.zeros_like(flat_current, dtype=np.float32)

        for delta, count in trusted_client_updates:
            weight = count / total_samples
            weighted_delta += delta.astype(np.float32) * weight

        # Apply aggregated delta: W_new = W_old + Delta_global
        new_flat = flat_current + weighted_delta
        new_weights = unflatten_weights(new_flat, current_weights)
        self.set_global_weights(new_weights)
        return new_weights

    def evaluate(self, test_loader: DataLoader) -> Dict[str, float]:
        """Evaluates global model on the dataset loader.

        Returns:
            Dict containing accuracy, balanced_accuracy, loss, precision, recall, specificity, auc, f1, and confusion_matrix.
        """
        self.global_model.eval()
        total_loss = 0.0
        all_preds = []
        all_targets = []
        all_probs = []

        with torch.no_grad():
            for images, labels in test_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)

                outputs = self.global_model(images)
                loss = self.criterion(outputs, labels)
                total_loss += loss.item() * len(labels)

                probs = torch.softmax(outputs, dim=1)[:, 1]
                preds = torch.argmax(outputs, dim=1)
                
                all_probs.extend(probs.cpu().numpy().tolist())
                all_preds.extend(preds.cpu().numpy().tolist())
                all_targets.extend(labels.cpu().numpy().tolist())

        total_samples = len(all_targets)
        avg_loss = total_loss / max(total_samples, 1)

        y_true = np.array(all_targets)
        y_pred = np.array(all_preds)
        y_prob = np.array(all_probs)

        accuracy = float(np.mean(y_true == y_pred))
        bal_acc = float(balanced_accuracy_score(y_true, y_pred))

        # Confusion matrix: [[TN, FP], [FN, TP]]
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        
        specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0

        try:
            auc = float(roc_auc_score(y_true, y_prob))
        except Exception:
            auc = 0.5

        p, r, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average="binary", zero_division=0
        )

        return {
            "loss": round(float(avg_loss), 4),
            "accuracy": round(float(accuracy), 4),
            "balanced_accuracy": round(float(bal_acc), 4),
            "precision": round(float(p), 4),
            "recall": round(float(recall), 4),
            "specificity": round(float(specificity), 4),
            "auc": round(float(auc), 4),
            "f1": round(float(f1), 4),
            "confusion_matrix": cm.tolist(),
        }

