"""Phase 2 Detector Benchmark Evaluation script across seeds (42, 43, 44), 20 rounds,
clean, attacked, defended scenarios for both label_flip and sign_flip.

Reproducibility note:
- Uses `config.MAD_THRESHOLD` (4.50) from the central configuration (`backend.app.config`)
  matching the tuned live simulation and production training settings.
- If historical Phase 2 benchmark tables in published papers used the earlier hardcoded
  value (2.50), that represents a prior experimental protocol; running this script evaluates
  under the updated tuned production threshold.
"""

import math
import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / 'backend'
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import torch
import json
from typing import Dict, List, Tuple

from backend.app import config
from backend.app.fl.server import FLServer
from backend.app.fl.client import HospitalClient
from backend.app.data.partition import partition_data
from backend.app.data.loader import get_test_loader, get_val_loader
from backend.app.detection.detector import PoisonDetector

def run_simulation(
    seed: int = 42,
    rounds: int = 20,
    scenario: str = "defended",
    attack_type: str = "label_flip",
    malicious_ids: List[int] = None,
) -> Dict:
    if malicious_ids is None:
        malicious_ids = [3, 7] if scenario != "clean" else []
    
    detection_enabled = (scenario == "defended")
    
    torch.manual_seed(seed)
    np.random.seed(seed)
    
    server = FLServer(conv1_channels=16, conv2_channels=32)
    detector = PoisonDetector(
        mad_threshold=config.MAD_THRESHOLD,
        persistence_k=2,
        persistence_m=3,
        warmup_rounds=2,
    )
    
    client_loaders, _ = partition_data(num_clients=8, batch_size=32, seed=seed, size=28)
    clients = [HospitalClient(cid, client_loaders[cid]) for cid in range(8)]
    test_loader = get_test_loader(batch_size=32, size=28)
    
    total_malicious_checks = 0
    detected_malicious_checks = 0
    total_honest_checks = 0
    excluded_honest_checks = 0
    max_excluded_in_any_round = 0
    
    round_accuracies = []
    
    for r in range(1, rounds + 1):
        global_w = server.get_global_weights()
        client_updates = {}
        client_samples = {}
        
        for client in clients:
            cid = client.client_id
            is_mal = (cid in malicious_ids)
            delta, num_samples, _ = client.train(
                global_weights=global_w,
                epochs=1,
                lr=0.001,
                is_malicious=is_mal,
                attack_type=attack_type,
            )
            client_updates[cid] = delta
            client_samples[cid] = num_samples
            
        verdicts, trusted_ids = detector.evaluate_round(r, client_updates, detection_enabled=detection_enabled)
        
        num_excluded = sum(1 for cid in range(8) if verdicts[cid].get("status") == "Excluded")
        if num_excluded > max_excluded_in_any_round:
            max_excluded_in_any_round = num_excluded
            
        for cid in range(8):
            is_mal = (cid in malicious_ids)
            is_excl = (verdicts[cid].get("status") == "Excluded")
            
            if is_mal:
                total_malicious_checks += 1
                if is_excl:
                    detected_malicious_checks += 1
            else:
                total_honest_checks += 1
                if is_excl:
                    excluded_honest_checks += 1
                    
        trusted_tuples = [(client_updates[cid], client_samples[cid]) for cid in trusted_ids]
        server.aggregate(trusted_tuples)
        
        metrics = server.evaluate(test_loader)
        round_accuracies.append(metrics["accuracy"])
        
    final_metrics = server.evaluate(test_loader)
    
    mal_det_rate = (detected_malicious_checks / total_malicious_checks) if total_malicious_checks > 0 else 0.0
    honest_excl_rate = (excluded_honest_checks / total_honest_checks) if total_honest_checks > 0 else 0.0
    
    return {
        "seed": seed,
        "scenario": scenario,
        "attack_type": attack_type,
        "final_accuracy": final_metrics["accuracy"],
        "final_recall": final_metrics["recall"],
        "final_f1": final_metrics["f1"],
        "malicious_detection_rate": mal_det_rate,
        "honest_false_exclusion_rate": honest_excl_rate,
        "max_excluded_round": max_excluded_in_any_round,
        "round_accuracies": round_accuracies,
    }

def main():
    seeds = [42, 43, 44]
    attacks = ["label_flip", "sign_flip"]
    scenarios = ["clean", "attacked", "defended"]
    
    print("==========================================================================================")
    print("PHASE 2 DETECTOR BENCHMARK EVALUATION (20 rounds, 8 clients, seeds 42, 43, 44)")
    print("==========================================================================================")
    
    full_results = {}
    
    for atk in attacks:
        print(f"\n>>> ATTACK TYPE: {atk.upper()} <<<")
        full_results[atk] = {}
        
        for sc in scenarios:
            full_results[atk][sc] = []
            print(f"\n--- Scenario: {sc.upper()} ---")
            accs, recs, mal_dets, hon_excls, max_excls = [], [], [], [], []
            
            for s in seeds:
                res = run_simulation(seed=s, rounds=20, scenario=sc, attack_type=atk)
                full_results[atk][sc].append(res)
                
                accs.append(res["final_accuracy"])
                recs.append(res["final_recall"])
                mal_dets.append(res["malicious_detection_rate"])
                hon_excls.append(res["honest_false_exclusion_rate"])
                max_excls.append(res["max_excluded_round"])
                
                print(f"Seed {s}: Acc={res['final_accuracy']:.4f}, Recall={res['final_recall']:.4f}, MalDetRate={res['malicious_detection_rate']*100:.1f}%, HonExclRate={res['honest_false_exclusion_rate']*100:.1f}%, MaxExcl={res['max_excluded_round']}")
                
            print(f"-> MEAN ± STD: Acc={np.mean(accs):.4f}±{np.std(accs):.4f}, Recall={np.mean(recs):.4f}±{np.std(recs):.4f}, MalDetRate={np.mean(mal_dets)*100:.1f}%, HonExclRate={np.mean(hon_excls)*100:.1f}%, MaxExcl={np.max(max_excls)}")

if __name__ == "__main__":
    main()
