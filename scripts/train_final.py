"""Final Federated Learning Training Script.

Trains production CNN models at specified resolution (64 or 128) with:
- 8 hospitals, mild non-IID Dirichlet alpha=2.0 partition
- Attackers (H4=client 3, H8=client 7) and protection ON by default (flags to turn off)
- Local epochs 2, mild augmentation (rotation up to 5 deg, no flips), class-weighted loss
- Early stopping on VALIDATION accuracy (minimum 10 rounds, patience 8)
- Saves best-validation model to models/final_model_<size>.pth and models/final_model_<size>_meta.json
- Evaluates test accuracy once using the best validation checkpoint
"""

import argparse
import copy
import datetime
import json
import logging
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / 'backend'
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import torch
import torchvision.transforms as T

from backend.app import config
from backend.app.data.loader import get_test_loader, get_val_loader, load_medmnist_raw, MedMNISTDataset
from backend.app.data.partition import partition_data
from backend.app.detection.detector import PoisonDetector
from backend.app.fl.client import HospitalClient
from backend.app.fl.server import FLServer

MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Train Final FL Model")
    parser.add_argument("--size", type=int, default=64, choices=[28, 64, 128], help="Image resolution (28, 64, 128)")
    parser.add_argument("--rounds", type=int, default=50, help="Maximum number of FL rounds")
    parser.add_argument("--patience", type=int, default=8, help="Patience rounds for early stopping on validation accuracy")
    parser.add_argument("--no-attack", action="store_true", help="Disable adversarial attackers")
    parser.add_argument("--no-protection", action="store_true", help="Disable poison detection and exclusion")
    parser.add_argument("--local-epochs", type=int, default=2, help="Local epochs per hospital client")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for training and evaluation")
    parser.add_argument("--lr", type=float, default=0.001, help="Client learning rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    return parser.parse_args()


def main():
    args = parse_args()
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    attack_enabled = not args.no_attack
    protection_enabled = not args.no_protection
    malicious_ids = [3, 7] if attack_enabled else []

    print(f"================================================================")
    print(f"AntiFLearning: Final Model Training (Resolution {args.size}x{args.size})")
    print(f"Rounds: {args.rounds} | Patience: {args.patience} | Local Epochs: {args.local_epochs}")
    print(f"Attack: {'ON (Clients 3, 7 -> H4, H8)' if attack_enabled else 'OFF'} | Protection: {'ON' if protection_enabled else 'OFF'}")
    print(f"================================================================")

    # 1. Prepare data with mild augmentation for clients (rotation up to 5 degrees, no flips)
    mild_aug = T.RandomRotation(degrees=(-5, 5))

    # Partition training data
    client_loaders, _ = partition_data(
        num_clients=8,
        batch_size=args.batch_size,
        seed=args.seed,
        size=args.size,
        alpha=2.0,
    )

    # Apply mild augmentation to each client dataset
    clients = []
    for cid in range(8):
        loader = client_loaders[cid]
        # Attach augmentation transform
        loader.dataset.transform = mild_aug
        client = HospitalClient(
            client_id=cid,
            data_loader=loader,
            resolution=args.size,
        )
        clients.append(client)

    val_loader = get_val_loader(batch_size=args.batch_size, size=args.size)
    test_loader = get_test_loader(batch_size=args.batch_size, size=args.size)

    server = FLServer(resolution=args.size)
    detector = PoisonDetector(
        mad_threshold=config.MAD_THRESHOLD,
        persistence_k=config.PERSISTENCE_K,
        persistence_m=config.PERSISTENCE_M,
        warmup_rounds=config.WARMUP_ROUNDS,
    )

    best_val_acc = -1.0
    best_round = 1
    best_state_dict = copy.deepcopy(server.global_model.state_dict())
    patience_counter = 0

    total_checks = 0
    total_accepted = 0
    total_rejected = 0
    total_excluded = 0
    mal_rejected = 0
    honest_rejected = 0

    # Training Loop
    actual_rounds_run = 0
    for r in range(1, args.rounds + 1):
        actual_rounds_run = r
        global_weights = server.get_global_weights()
        client_updates = {}
        client_samples = {}

        # Hospital clients train locally
        for client in clients:
            cid = client.client_id
            is_mal = (cid in malicious_ids)
            delta, num_samples, _ = client.train(
                global_weights=global_weights,
                epochs=args.local_epochs,
                lr=args.lr,
                is_malicious=is_mal,
                attack_type="label_flip",
            )
            client_updates[cid] = delta
            client_samples[cid] = num_samples

        # Anomaly detection and persistence
        verdicts, trusted_ids = detector.evaluate_round(
            round_no=r,
            client_updates=client_updates,
            detection_enabled=protection_enabled,
        )
        accepted_ids = [cid for cid, v in verdicts.items() if v["status"] == "Accepted"]
        rejected_ids = [cid for cid, v in verdicts.items() if v["status"] == "Rejected"]
        excluded_ids = [cid for cid, v in verdicts.items() if v["status"] == "Excluded"]

        total_checks += len(client_updates)
        total_accepted += len(accepted_ids)
        total_rejected += len(rejected_ids)
        total_excluded += len(excluded_ids)
        for cid in rejected_ids:
            if cid in malicious_ids:
                mal_rejected += 1
            else:
                honest_rejected += 1

        # Server FedAvg aggregation
        if len(accepted_ids) >= 1:
            trusted_updates = [(client_updates[cid], client_samples[cid]) for cid in accepted_ids]
            server.aggregate(trusted_updates)

        # Evaluate on official VALIDATION set
        val_eval = server.evaluate(val_loader)
        val_acc = val_eval["accuracy"]

        # Log one progress line per round (round, validation accuracy, accepted, rejected, excluded)
        print(f"round: {r:02d} | validation accuracy: {val_acc:.4f} | accepted: {len(accepted_ids)} | rejected: {len(rejected_ids)} | excluded: {len(excluded_ids)}")

        # Check early stopping condition (minimum 10 rounds, patience 8)
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_round = r
            best_state_dict = copy.deepcopy(server.global_model.state_dict())
            patience_counter = 0
        else:
            if r >= 10:
                patience_counter += 1
                if patience_counter >= args.patience:
                    print(f"Early stopping triggered at round {r} (patience {args.patience} reached without validation improvement).")
                    break

    # Save best-validation model
    model_save_path = MODELS_DIR / f"final_model_{args.size}.pth"
    torch.save(best_state_dict, model_save_path)
    print(f"\nSaved best model checkpoint (Round {best_round}, Val Acc: {best_val_acc:.4f}) to {model_save_path}")

    # Evaluate ONCE on global test set using chosen best model
    server.global_model.load_state_dict(best_state_dict)
    test_eval = server.evaluate(test_loader)
    print(f"Final Test Evaluation: Accuracy={test_eval['accuracy']:.4f}, Sensitivity={test_eval['recall']:.4f}, Specificity={test_eval['specificity']:.4f}, AUC={test_eval['auc']:.4f}")

    # Build meta JSON
    meta_data = {
        "resolution": args.size,
        "rounds_run": actual_rounds_run,
        "best_round": best_round,
        "validation_accuracy": round(float(best_val_acc), 4),
        "test_accuracy": round(float(test_eval["accuracy"]), 4),
        "sensitivity": round(float(test_eval["recall"]), 4),
        "specificity": round(float(test_eval["specificity"]), 4),
        "precision": round(float(test_eval["precision"]), 4),
        "f1": round(float(test_eval["f1"]), 4),
        "auc": round(float(test_eval["auc"]), 4),
        "confusion_matrix": test_eval["confusion_matrix"],
        "attack_and_protection_config": {
            "attack_enabled": attack_enabled,
            "attack_type": "label_flip",
            "malicious_clients": [3, 7] if attack_enabled else [],
            "protection_enabled": protection_enabled,
            "detector": "cosine_mad",
        },
        "detection_stats": {
            "total_checks": total_checks,
            "total_accepted": total_accepted,
            "total_rejected": total_rejected,
            "total_excluded": total_excluded,
            "malicious_rejected": mal_rejected,
            "honest_rejected": honest_rejected,
        },
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    meta_save_path = MODELS_DIR / f"final_model_{args.size}_meta.json"
    with open(meta_save_path, "w", encoding="utf-8") as f:
        json.dump(meta_data, f, indent=2)
    print(f"Saved meta JSON to {meta_save_path}")


if __name__ == "__main__":
    main()
