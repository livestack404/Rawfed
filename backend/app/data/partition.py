"""Data partitioning among simulated hospital clients.

Produces roughly IID splits with mild variation in dataset size and class mix,
reflecting realistic multi-center hospital variations while remaining reproducible.
"""

import numpy as np
import torch
from torch.utils.data import DataLoader, Subset
from typing import Dict, List, Tuple
from app import config
from app.data.loader import load_medmnist_raw, MedMNISTDataset

def partition_data(
    num_clients: int = config.NUM_CLIENTS,
    batch_size: int = config.BATCH_SIZE,
    seed: int = config.PARTITION_SEED,
    size: int = config.IMAGE_SIZE,
    alpha: float = config.DIRICHLET_ALPHA,
    min_samples: int = config.MIN_CLIENT_SAMPLES,
    min_class_ratio: float = config.MIN_CLASS_RATIO,
) -> Tuple[Dict[int, DataLoader], Dict[int, Dict[str, int]]]:
    """Partitions PneumoniaMNIST training data across `num_clients` hospitals.

    Mildly non-IID partition using Dirichlet alpha=2.0, ensuring at least `min_samples` per hospital
    and enforcing a minimum class ratio floor `min_class_ratio` for each class.

    Returns:
        client_loaders: Dict[int, DataLoader] mapping client_id -> DataLoader
        client_stats: Dict[int, Dict] containing sample counts and class counts per client
    """
    (train_imgs, train_lbls), _, _ = load_medmnist_raw(size=size)
    full_train_dataset = MedMNISTDataset(train_imgs, train_lbls)
    total_samples = len(full_train_dataset)
    labels = train_lbls.squeeze()

    rng = np.random.default_rng(seed)

    # Separate indices by class (0: Normal, 1: Pneumonia)
    class_0_indices = np.where(labels == 0)[0]
    class_1_indices = np.where(labels == 1)[0]
    rng.shuffle(class_0_indices)
    rng.shuffle(class_1_indices)

    # Sample Dirichlet distributions with rejection/adjustment if any client has < min_samples or < min_class_ratio
    max_attempts = 100
    for attempt in range(max_attempts):
        dirichlet_0 = rng.dirichlet(np.full(num_clients, alpha))
        dirichlet_1 = rng.dirichlet(np.full(num_clients, alpha))

        c0_counts = np.floor(dirichlet_0 * len(class_0_indices)).astype(int)
        c1_counts = np.floor(dirichlet_1 * len(class_1_indices)).astype(int)

        # Allocate remainder
        c0_rem = len(class_0_indices) - c0_counts.sum()
        c1_rem = len(class_1_indices) - c1_counts.sum()
        for i in range(c0_rem):
            c0_counts[i % num_clients] += 1
        for i in range(c1_rem):
            c1_counts[i % num_clients] += 1

        total_per_client = c0_counts + c1_counts
        r0 = c0_counts / np.maximum(total_per_client, 1)
        r1 = c1_counts / np.maximum(total_per_client, 1)
        valid_samples = np.all(total_per_client >= min_samples)
        valid_ratios = np.all(r0 >= min_class_ratio) and np.all(r1 >= min_class_ratio)
        if (valid_samples and valid_ratios) or attempt == max_attempts - 1:
            break

    client_loaders = {}
    client_stats = {}

    idx_0 = 0
    idx_1 = 0
    for cid in range(num_clients):
        c0_idx = class_0_indices[idx_0 : idx_0 + c0_counts[cid]]
        c1_idx = class_1_indices[idx_1 : idx_1 + c1_counts[cid]]
        idx_0 += c0_counts[cid]
        idx_1 += c1_counts[cid]

        client_indices = np.concatenate([c0_idx, c1_idx])
        rng.shuffle(client_indices)

        subset = Subset(full_train_dataset, client_indices.tolist())
        loader = DataLoader(subset, batch_size=batch_size, shuffle=True)

        client_loaders[cid] = loader
        client_stats[cid] = {
            "total": len(client_indices),
            "normal": int(c0_counts[cid]),
            "pneumonia": int(c1_counts[cid]),
            "prevalence": round(float(c1_counts[cid]) / len(client_indices), 4),
        }

    return client_loaders, client_stats

