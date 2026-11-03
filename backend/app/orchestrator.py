"""Central Orchestrator for Federated Learning, Poisoning Attack Detection, and Blockchain Audit.

SEPARATION RULE ENFORCEMENT:
- fl/ knows only FL algorithms and models.
- detection/ imports nothing from blockchain/ or fl/.
- blockchain/ only records audit trails and never influences training.
- orchestrator.py is the ONLY file importing fl, detection, and blockchain modules.
"""

import asyncio
import csv
import json
import logging
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple
import numpy as np
import torch

from app import config
from app.state import training_state
from app.data.loader import get_val_loader, get_test_loader, load_medmnist_raw, MedMNISTDataset
from app.data.partition import partition_data
from app.fl import (
    HospitalClient,
    FLServer,
    compute_update_hash,
)
from app.detection import PoisonDetector
from app.blockchain import BlockchainLogger

logger = logging.getLogger(__name__)

class FLOrchestrator:
    def __init__(self):
        self.blockchain = BlockchainLogger()
        self.detector = PoisonDetector(
            mad_threshold=config.MAD_THRESHOLD,
            persistence_k=config.PERSISTENCE_K,
            persistence_m=config.PERSISTENCE_M,
            warmup_rounds=config.WARMUP_ROUNDS,
        )
        self.step_delay: float = config.STEP_DELAY_SECONDS


    async def _wait_for_step_or_resume(self):
        """Allows stepping through the 6 simulation phases one at a time while paused,
        and pauses for self.step_delay (default 1.2s) between phases when running.
        """
        if not training_state.is_paused:
            if self.step_delay > 0:
                await asyncio.sleep(self.step_delay)
            return

        while training_state.is_paused:
            if training_state.should_stop:
                break
            if training_state.step_requested:
                training_state.step_requested = False
                break
            await asyncio.sleep(0.05)

    async def run_simulation(
        self,
        run_config: config.RunConfig,
        progress_callback: Optional[Callable[[str, Dict], None]] = None,
    ) -> Dict:
        """Executes one end-to-end federated learning simulation run."""
        torch.manual_seed(run_config.seed)
        np.random.seed(run_config.seed)

        training_state.is_running = True
        training_state.is_paused = False
        training_state.should_stop = False
        training_state.current_round = 0
        training_state.total_rounds = run_config.rounds
        training_state.current_scenario = run_config.scenario
        training_state.active_config = run_config.model_dump()
        training_state.current_run_events.clear()

        # Reset detector and blockchain for fresh run
        self.detector.reset()
        self.blockchain.reset()

        # Output paths
        scenario_dir = config.RESULTS_DIR / run_config.scenario
        scenario_dir.mkdir(parents=True, exist_ok=True)

        server = FLServer()
        val_loader = get_val_loader(batch_size=config.BATCH_SIZE)
        test_loader = get_test_loader(batch_size=config.BATCH_SIZE)
        client_loaders, client_stats = partition_data(
            num_clients=run_config.num_clients,
            batch_size=run_config.batch_size,
            seed=getattr(run_config, "partition_seed", config.PARTITION_SEED),
        )

        clients = {
            cid: HospitalClient(cid, loader)
            for cid, loader in client_loaders.items()
        }

        round_records = []
        start_time = time.time()
        best_accuracy = 0.0

        # Read existing best accuracy if available
        best_model_meta_file = config.CHECKPOINTS_DIR / "best_model_meta.json"
        if best_model_meta_file.exists():
            try:
                with open(best_model_meta_file, "r") as f:
                    meta = json.load(f)
                    best_accuracy = meta.get("accuracy", 0.0)
            except Exception:
                best_accuracy = 0.0

        all_decision_records = []
        caught_attackers = {}  # attacker_id -> round caught
        honest_wrongly_flagged = set()

        try:
            for round_no in range(1, run_config.rounds + 1):
                if training_state.should_stop:
                    logger.info("Simulation run stopped by user request.")
                    break

                await self._wait_for_step_or_resume()

                training_state.current_round = round_no

                # Event 1: round_started
                await training_state.emit_event("round_started", {
                    "round": round_no,
                    "total_rounds": run_config.rounds,
                    "scenario": run_config.scenario,
                })

                # Step 1: global_model_broadcast
                await self._wait_for_step_or_resume()
                global_weights = server.get_global_weights()
                await training_state.emit_event("global_model_broadcast", {
                    "round": round_no,
                    "model_version": round_no - 1,
                    "message": f"Server sends global model v{round_no - 1} to H1 ... H8",
                })

                # Step 2: client_training (per hospital)
                await self._wait_for_step_or_resume()
                client_updates = {}
                sample_counts = {}
                update_hashes = {}
                update_norms = {}
                local_losses = {}

                for cid in sorted(clients.keys()):
                    client = clients[cid]
                    is_mal = (cid in run_config.malicious_ids)
                    delta, count, loss = client.train(
                        global_weights=global_weights,
                        epochs=run_config.local_epochs,
                        lr=run_config.learning_rate,
                        is_malicious=is_mal,
                        attack_type=run_config.attack_type,
                    )
                    norm = float(np.linalg.norm(delta))
                    client_updates[cid] = delta
                    sample_counts[cid] = count
                    update_hashes[cid] = compute_update_hash(delta)
                    update_norms[cid] = norm
                    local_losses[cid] = float(loss)

                    await training_state.emit_event("client_training", {
                        "round": round_no,
                        "client_id": cid,
                        "hospital_id": f"H{cid+1}",
                        "n_samples": count,
                        "local_loss": round(float(loss), 4),
                        "update_norm": round(norm, 4),
                        "message": f"H{cid+1} trained on {count} images, local loss {float(loss):.4f}",
                    })

                # Step 3: client_update_sent (per hospital)
                await self._wait_for_step_or_resume()
                for cid in sorted(clients.keys()):
                    await training_state.emit_event("client_update_sent", {
                        "round": round_no,
                        "client_id": cid,
                        "hospital_id": f"H{cid+1}",
                        "n_samples": sample_counts[cid],
                        "local_loss": round(float(local_losses[cid]), 4),
                        "update_norm": round(update_norms[cid], 4),
                        "message": f"H{cid+1} sent update (size {update_norms[cid]:.4f})",
                    })

                # Step 4: Detection
                await self._wait_for_step_or_resume()
                verdicts, trusted_ids = self.detector.evaluate_round(
                    round_no=round_no,
                    client_updates=client_updates,
                    detection_enabled=run_config.detection,
                    run_id=run_config.scenario,
                )

                # Track ground truth for run end detection report (never leaked to detector)
                for cid, v in verdicts.items():
                    all_decision_records.append(v)
                    if cid in run_config.malicious_ids:
                        if v["status"] in ["Rejected", "Excluded"] and cid not in caught_attackers:
                            caught_attackers[cid] = round_no
                    else:
                        if v["status"] in ["Rejected", "Excluded"]:
                            honest_wrongly_flagged.add(cid)

                # Event 5: detection_complete (all decision records)
                await training_state.emit_event("detection_complete", {
                    "round": round_no,
                    "records": list(verdicts.values()),
                    "records_by_client": verdicts,
                })

                # Step 5: FedAvg aggregation over trusted updates (skip if quorum not met)
                await self._wait_for_step_or_resume()
                if trusted_ids:
                    trusted_tuples = [
                        (client_updates[cid], sample_counts[cid])
                        for cid in trusted_ids
                    ]
                    server.aggregate(trusted_tuples)
                    aggregation_status = "success"
                else:
                    logger.warning(f"Round {round_no}: Quorum not met (<3 accepted updates). Skipping aggregation.")
                    aggregation_status = "skipped_quorum"

                # Evaluate global model on validation set
                val_metrics = server.evaluate(val_loader)

                # Event 6: aggregation_complete (new validation accuracy and loss)
                await training_state.emit_event("aggregation_complete", {
                    "round": round_no,
                    "model_version": round_no,
                    "status": aggregation_status,
                    "trusted_count": len(trusted_ids),
                    "excluded_count": len(client_updates) - len(trusted_ids),
                    "accuracy": val_metrics["accuracy"],
                    "loss": val_metrics["loss"],
                    "metrics": val_metrics,
                })

                # Step 6: Log decision records to ledger
                await self._wait_for_step_or_resume()
                chain_time_start = time.time()
                logged_entries = []
                for cid in sorted(clients.keys()):
                    v = verdicts[cid]
                    block_entry = self.blockchain.log_decision_record(v)
                    logged_entries.append(block_entry)

                chain_ms = (time.time() - chain_time_start) * 1000.0

                # Event 7: ledger_written
                await training_state.emit_event("ledger_written", {
                    "round": round_no,
                    "entries_count": len(logged_entries),
                    "mode": self.blockchain.mode,
                })

                # Assemble round record (per-round accuracy is validation accuracy)
                rec = {
                    "round": round_no,
                    "accuracy": val_metrics["accuracy"],
                    "loss": val_metrics["loss"],
                    "precision": val_metrics["precision"],
                    "recall": val_metrics["recall"],
                    "f1": val_metrics["f1"],
                    "trusted_clients": len(trusted_ids),
                    "excluded_clients": len(client_updates) - len(trusted_ids),
                    "blockchain_ms": round(chain_ms, 2),
                }
                round_records.append(rec)

                # Event 8: round_completed
                await training_state.emit_event("round_completed", {
                    "round": round_no,
                    "record": rec,
                })

                # Checkpoint saving rule (Clean / Defended based on validation accuracy)
                if run_config.scenario in [config.SCENARIO_CLEAN, config.SCENARIO_DEFENDED]:
                    if val_metrics["accuracy"] >= best_accuracy:
                        best_accuracy = val_metrics["accuracy"]
                        best_path = config.CHECKPOINTS_DIR / "best_model.pth"
                        torch.save(server.global_model.state_dict(), best_path)
                        with open(best_model_meta_file, "w") as f:
                            json.dump({
                                "accuracy": best_accuracy,
                                "val_accuracy": best_accuracy,
                                "scenario": run_config.scenario,
                                "round": round_no,
                                "timestamp": time.time(),
                            }, f, indent=2)

                if run_config.speed_ms > 0:
                    await asyncio.sleep(run_config.speed_ms / 1000.0)

        except Exception as e:
            logger.error(f"Error during FL simulation: {e}", exc_info=True)
            await training_state.emit_event("error", {"message": str(e)})
            raise
        finally:
            training_state.is_running = False
            training_state.is_paused = False

            # Final evaluation on test set ONCE at run end
            final_test_metrics = server.evaluate(test_loader)
            logger.info(f"Final test accuracy evaluated at run end: {final_test_metrics['accuracy']:.4f}")

            # Detection report computed from ground truth
            detection_report = {
                "actual_attackers": run_config.malicious_ids,
                "caught_attackers": caught_attackers,
                "honest_wrongly_flagged_or_excluded": list(honest_wrongly_flagged),
                "honest_wrongly_flagged_count": len(honest_wrongly_flagged),
            }

            # Save per-round CSV, metrics.json, and records.json under experiments/results/<scenario>/
            self._save_results(
                scenario_dir,
                round_records,
                run_config,
                start_time,
                final_test_metrics=final_test_metrics,
                decision_records=all_decision_records,
                detection_report=detection_report,
            )

            summary = {
                "scenario": run_config.scenario,
                "total_rounds": len(round_records),
                "final_accuracy": final_test_metrics["accuracy"],
                "final_val_accuracy": round_records[-1]["accuracy"] if round_records else 0.0,
                "best_val_accuracy": max((r["accuracy"] for r in round_records), default=0.0),
                "best_accuracy": max((r["accuracy"] for r in round_records), default=0.0),
                "detection_report": detection_report,
                "elapsed_seconds": round(time.time() - start_time, 2),
            }
            # Event 9: run_completed (summary + detection report)
            await training_state.emit_event("run_completed", summary)
            return summary

    def _save_results(
        self,
        scenario_dir: Path,
        round_records: List[Dict],
        run_config: config.RunConfig,
        start_time: float,
        final_test_metrics: Optional[Dict] = None,
        decision_records: Optional[List[Dict]] = None,
        detection_report: Optional[Dict] = None,
    ):
        """Saves per-round CSV, metrics JSON, records JSON, and full event log."""
        if not round_records:
            return

        # 1. Round metrics CSV
        csv_path = scenario_dir / "round_metrics.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(round_records[0].keys()))
            writer.writeheader()
            writer.writerows(round_records)

        # 2. Metrics summary JSON
        summary_path = scenario_dir / "metrics.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump({
                "scenario": run_config.scenario,
                "config": run_config.model_dump(),
                "rounds": round_records,
                "elapsed_seconds": round(time.time() - start_time, 2),
                "final_metrics": round_records[-1] if round_records else {},
                "final_test_metrics": final_test_metrics or {},
                "detection_report": detection_report or {},
            }, f, indent=2)

        # 3. Decision records JSON (4.3 & 4.4: records.json)
        records_path = scenario_dir / "records.json"
        with open(records_path, "w", encoding="utf-8") as f:
            json.dump(decision_records or [], f, indent=2)

        # 4. Event log JSON for Replay feature
        event_log_path = scenario_dir / "event_log.json"
        with open(event_log_path, "w", encoding="utf-8") as f:
            json.dump(training_state.current_run_events, f, indent=2)

orchestrator = FLOrchestrator()

