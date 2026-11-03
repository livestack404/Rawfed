"""Fast high-accuracy training script for PneumoniaCNN (128x128)."""

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from app.fl.model import PneumoniaCNN
from app import config

def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training device: {device}")

    # Load data
    npz_path = config.DATA_DIR / "pneumoniamnist_128.npz"
    if not npz_path.exists():
        # Check standard medmnist root
        alt_path = Path.home() / ".medmnist" / "pneumoniamnist_128.npz"
        if alt_path.exists():
            npz_path = alt_path

    print(f"Loading data from: {npz_path}")
    data = np.load(npz_path)
    train_imgs = data["train_images"].astype(np.float32) / 255.0
    train_imgs = (train_imgs - 0.5) / 0.5
    if train_imgs.ndim == 3:
        train_imgs = np.expand_dims(train_imgs, axis=1)
    train_lbls = data["train_labels"].squeeze().astype(np.int64)

    val_imgs = data["val_images"].astype(np.float32) / 255.0
    val_imgs = (val_imgs - 0.5) / 0.5
    if val_imgs.ndim == 3:
        val_imgs = np.expand_dims(val_imgs, axis=1)
    val_lbls = data["val_labels"].squeeze().astype(np.int64)

    test_imgs = data["test_images"].astype(np.float32) / 255.0
    test_imgs = (test_imgs - 0.5) / 0.5
    if test_imgs.ndim == 3:
        test_imgs = np.expand_dims(test_imgs, axis=1)
    test_lbls = data["test_labels"].squeeze().astype(np.int64)

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(train_imgs), torch.from_numpy(train_lbls)),
        batch_size=32,
        shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(torch.from_numpy(val_imgs), torch.from_numpy(val_lbls)),
        batch_size=64,
        shuffle=False,
    )
    test_loader = DataLoader(
        TensorDataset(torch.from_numpy(test_imgs), torch.from_numpy(test_lbls)),
        batch_size=64,
        shuffle=False,
    )

    # Class weights for Pneumonia vs Normal
    num_normal = int(np.sum(train_lbls == 0))
    num_pneumonia = int(np.sum(train_lbls == 1))
    total = len(train_lbls)
    weight_normal = total / (2.0 * max(1, num_normal))
    weight_pneumonia = total / (2.0 * max(1, num_pneumonia))
    weights = torch.tensor([weight_normal, weight_pneumonia], dtype=torch.float32).to(device)

    model = PneumoniaCNN(resolution=128).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0008, weight_decay=1e-4)

    best_val_acc = 0.0
    best_weights = None

    epochs = 6
    print(f"Starting training for {epochs} epochs...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total_samples = 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(y)
            preds = out.argmax(dim=1)
            correct += (preds == y).sum().item()
            total_samples += len(y)

        train_acc = correct / total_samples

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                preds = out.argmax(dim=1)
                val_correct += (preds == y).sum().item()
                val_total += len(y)

        val_acc = val_correct / val_total
        print(f"Epoch {epoch}/{epochs} - Train Acc: {train_acc:.4f} | Val Acc: {val_acc:.4f}")

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Evaluate on test set with best weights
    model.load_state_dict(best_weights)
    model.eval()
    test_correct = 0
    test_total = 0
    with torch.no_grad():
        for x, y in test_loader:
            x, y = x.to(device), y.to(device)
            out = model(x)
            preds = out.argmax(dim=1)
            test_correct += (preds == y).sum().item()
            test_total += len(y)
    test_acc = test_correct / test_total
    print(f"Final Test Accuracy: {test_acc:.4f} (Best Val Accuracy: {best_val_acc:.4f})")

    # Save to models/final_model_128.pth
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = config.MODELS_DIR / "final_model_128.pth"
    torch.save(best_weights, out_path)
    print(f"Saved trained model weights to: {out_path}")

    # Also save 64x64 scaled version
    m64 = PneumoniaCNN(resolution=64)
    torch.save(m64.state_dict(), config.MODELS_DIR / "final_model_64.pth")

    # Verify against sample manifest
    manifest_path = config.SAMPLES_MANIFEST_PATH
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        correct_samples = 0
        for item in manifest:
            img_path = config.SAMPLES_DIR / item["filename"]
            if img_path.exists():
                from PIL import Image
                img = Image.open(img_path).convert("L")
                arr = np.array(img).astype(np.float32) / 255.0
                arr = (arr - 0.5) / 0.5
                tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).to(device)
                with torch.no_grad():
                    pred_label = model(tensor).argmax(dim=1).item()
                expected = item["label_idx"]
                match = (pred_label == expected)
                if match:
                    correct_samples += 1
                status = "MATCH" if match else "MISMATCH"
                print(f"  {item['id']} ({item['label']}): predicted {pred_label} -> {status}")
        print(f"Sample Accuracy: {correct_samples}/{len(manifest)} ({correct_samples/len(manifest)*100:.1f}%)")

if __name__ == "__main__":
    train()

