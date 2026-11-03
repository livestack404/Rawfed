"""Data loader for MedMNIST datasets (default: PneumoniaMNIST).

Provides standardized PyTorch Dataset wrappers with grayscale normalization.
One-line swappable to other MedMNIST datasets.
"""

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from typing import Tuple, Optional
import os

from app import config

class MedMNISTDataset(Dataset):
    """Custom PyTorch Dataset for MedMNIST npz arrays with standard preprocessing."""
    def __init__(self, images: np.ndarray, labels: np.ndarray, transform=None):
        # Images: (N, 28, 28) or (N, 28, 28, 1)
        if images.ndim == 3:
            images = np.expand_dims(images, axis=1)  # (N, 1, 28, 28)
        elif images.ndim == 4 and images.shape[-1] == 1:
            images = np.transpose(images, (0, 3, 1, 2))  # (N, 1, 28, 28)
            
        self.images = images.astype(np.float32) / 255.0
        # Normalize to [-1, 1] range: (x - 0.5) / 0.5
        self.images = (self.images - 0.5) / 0.5
        
        # Labels: flatten to (N,) int64
        self.labels = labels.squeeze().astype(np.int64)
        self.transform = transform

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        img = torch.from_numpy(self.images[idx])
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        if self.transform:
            img = self.transform(img)
        return img, label

def load_medmnist_raw(
    dataset_name: str = config.DATASET,
    data_dir: Path = config.DATA_DIR,
    size: int = config.IMAGE_SIZE,
):
    """Load raw train, val, and test arrays from local npz or medmnist package."""
    suffix = f"_{size}" if size != 28 else ""
    npz_path = data_dir / f"{dataset_name}{suffix}.npz"
    if npz_path.exists():
        data = np.load(npz_path)
        train_imgs, train_lbls = data["train_images"], data["train_labels"]
        val_imgs, val_lbls = data["val_images"], data["val_labels"]
        test_imgs, test_lbls = data["test_images"], data["test_labels"]
        return (train_imgs, train_lbls), (val_imgs, val_lbls), (test_imgs, test_lbls)
    
    # Fallback to medmnist package download if npz not at expected local path
    import medmnist
    info = medmnist.INFO[dataset_name]
    DataClass = getattr(medmnist, info["python_class"])
    
    train_data = DataClass(split="train", download=True, size=size, root=str(data_dir))
    val_data = DataClass(split="val", download=True, size=size, root=str(data_dir))
    test_data = DataClass(split="test", download=True, size=size, root=str(data_dir))
    
    return (
        (train_data.imgs, train_data.labels),
        (val_data.imgs, val_data.labels),
        (test_data.imgs, test_data.labels),
    )

def get_val_loader(batch_size: int = config.BATCH_SIZE, size: int = config.IMAGE_SIZE) -> DataLoader:
    """Returns the evaluation DataLoader for the official validation set."""
    _, (val_imgs, val_lbls), _ = load_medmnist_raw(size=size)
    dataset = MedMNISTDataset(val_imgs, val_lbls)
    return DataLoader(dataset, batch_size=batch_size, shuffle=False)

def get_test_loader(batch_size: int = config.BATCH_SIZE, size: int = config.IMAGE_SIZE) -> DataLoader:
    """Returns the evaluation DataLoader for the global test set."""
    _, _, (test_imgs, test_lbls) = load_medmnist_raw(size=size)
    dataset = MedMNISTDataset(test_imgs, test_lbls)
    return DataLoader(dataset, batch_size=batch_size, shuffle=False)

