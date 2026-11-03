"""Unit tests for Blockchain and Mock Ledger.

Validates per spec 4.5:
- Clean ledger passes Verify ("All N entries intact")
- Local decision record tampering (e.g. flipping Rejected to Accepted) fails Verify ("Record N does not match the blockchain")
- Restore reverts local records and passes Verify
- Blockchain itself is never modified
"""

from pathlib import Path
import tempfile
import pytest

from app.blockchain.logger import BlockchainLogger
from app.blockchain.mock_ledger import LocalRecordStore, canonical_fingerprint


def test_clean_ledger_passes_verify():
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_path = Path(tmpdir) / "test_ledger.json"
        local_path = Path(tmpdir) / "local_records.json"

        logger = BlockchainLogger()
        logger.mock_ledger.storage_path = mock_path
        logger.mock_ledger.reset()
        logger.local_store.storage_path = local_path
        logger.local_store.backup_path = Path(tmpdir) / "local_records_backup.json"
        logger.local_store.reset()

        # Log 3 decisions
        for i in range(3):
            logger.log_decision_record({
                "round": 1,
                "hospital_id": f"H{i+1}",
                "status": "Accepted",
                "cosine_similarity": 0.85,
                "update_hash": f"0xabc{i}",
            })

        verify_res = logger.verify_integrity()
        assert verify_res["valid"] is True
        assert "All 3 entries intact" in verify_res["message"]


def test_tamper_and_restore():
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_path = Path(tmpdir) / "test_ledger.json"
        local_path = Path(tmpdir) / "local_records.json"

        logger = BlockchainLogger()
        logger.mock_ledger.storage_path = mock_path
        logger.mock_ledger.reset()
        logger.local_store.storage_path = local_path
        logger.local_store.backup_path = Path(tmpdir) / "local_records_backup.json"
        logger.local_store.reset()

        # Log 3 decisions
        for i in range(3):
            logger.log_decision_record({
                "round": 1,
                "hospital_id": f"H{i+1}",
                "status": "Accepted" if i < 2 else "Rejected",
                "cosine_similarity": 0.85 if i < 2 else -0.5,
                "update_hash": f"0xabc{i}",
            })

        # 1. Clean passes
        assert logger.verify_integrity()["valid"] is True

        # 2. Tamper entry #1 in local store (flip Rejected to Accepted or Accepted to Rejected)
        tamper_res = logger.tamper_attempt(1)
        assert tamper_res["success"] is True

        # Verify must fail now with "Record 1 does not match the blockchain"
        verify_fail = logger.verify_integrity()
        assert verify_fail["valid"] is False
        assert "Record 1 does not match the blockchain" in verify_fail["message"]

        # 3. Restore reverts local records back to original
        restore_res = logger.restore_attempt()
        assert restore_res["success"] is True

        # Verify must pass again
        verify_pass = logger.verify_integrity()
        assert verify_pass["valid"] is True
        assert "All 3 entries intact" in verify_pass["message"]

