"""Automated Experiment Runner for Federated Healthcare Security.

Executes and logs all three core evaluation scenarios:
1. Clean baseline (no attacks)
2. Attacked baseline (unmitigated label-flip / sign-flip attack)
3. Defended prototype (cosine MAD robust detection + persistence tracking)

Outputs per-round CSVs, summary JSONs, and event logs for UI comparison.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root and backend dir to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / 'backend'
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

from backend.app import config
from backend.app.config import RunConfig
from backend.app.orchestrator import orchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("experiments")

async def run_scenario(name: str, malicious_ids: list, detection: bool, rounds: int = 10):
    logger.info(f"\n==========================================")
    logger.info(f"Running Scenario: {name.upper()}")
    logger.info(f"Rounds: {rounds} | Malicious IDs: {malicious_ids} | Detection: {detection}")
    logger.info(f"==========================================")

    cfg = RunConfig(
        scenario=name,
        num_clients=config.NUM_CLIENTS,
        malicious_ids=malicious_ids,
        detection=detection,
        attack_type="label_flip",
        rounds=rounds,
        local_epochs=1,
        batch_size=32,
        speed_ms=0,  # Fast execution for batch runs
        seed=42,
    )

    summary = await orchestrator.run_simulation(cfg)
    logger.info(f"Completed {name}: Best Acc: {summary['best_accuracy']:.4f}, Final Acc: {summary['final_accuracy']:.4f}")
    return summary

async def main():
    rounds = 10
    if len(sys.argv) > 1:
        try:
            rounds = int(sys.argv[1])
        except ValueError:
            pass

    logger.info(f"Starting benchmark suite with {rounds} rounds per scenario...")

    # 1. Clean (no attackers, detector on)
    await run_scenario("clean", malicious_ids=[], detection=True, rounds=rounds)

    # 2. Attacked (attackers, detector OFF)
    await run_scenario("attacked", malicious_ids=config.DEFAULT_MALICIOUS_CLIENTS, detection=False, rounds=rounds)

    # 3. Defended (attackers, detector ON)
    await run_scenario("defended", malicious_ids=config.DEFAULT_MALICIOUS_CLIENTS, detection=True, rounds=rounds)

    logger.info("\nAll experiment runs successfully completed! Results stored in experiments/results/")

if __name__ == "__main__":
    asyncio.run(main())
