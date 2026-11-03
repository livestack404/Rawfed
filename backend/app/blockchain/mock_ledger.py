"""Local decision records storage and cryptographic hash-chain fallback.

Per 4.5 Ledger design:
- Full decision records live in a normal local store (JSON file).
- Only the record fingerprint (SHA-256 of canonical JSON: sorted keys, no spaces)
  plus round, hospital_id, and a status code goes on the blockchain.
- Never put images or weights on chain.
- Tamper demo edits the local copy only (e.g. flips Rejected to Accepted).
- Verify recomputes each local record fingerprint and compares with the chain entry.
- Restore reverts the local copy back to original from saved backups.
"""

import copy
import hashlib
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app import config

# Status code mappings for blockchain storage (uint8)
STATUS_TO_CODE = {
    "Accepted": 1,
    "Rejected": 2,
    "Excluded": 3,
}
CODE_TO_STATUS = {v: k for k, v in STATUS_TO_CODE.items()}


def canonical_fingerprint(record: Dict) -> str:
    """Computes SHA-256 of canonical JSON (sorted keys, no extra spaces)."""
    # Exclude internal tracking keys and stored fingerprint
    clean_record = {k: v for k, v in record.items() if not k.startswith("_") and k != "fingerprint"}
    canonical_str = json.dumps(clean_record, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


class MockLedger:
    """Simulated local blockchain fallback holding block fingerprints and status codes."""

    def __init__(self, storage_path: Path = config.MOCK_LEDGER_PATH):
        self.storage_path = storage_path
        self.chain_entries: List[Dict] = []
        self._load()

    def _load(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.chain_entries = json.load(f)
            except Exception:
                self.chain_entries = []
        else:
            self.chain_entries = []

    def _save(self):
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self.chain_entries, f, indent=2)

    def reset(self):
        self.chain_entries = []
        if self.storage_path.exists():
            self.storage_path.unlink()

    def add_entry(self, record_hash: str, round_no: int, hospital_id: str, status_code: int) -> Dict:
        index = len(self.chain_entries)
        prev_hash = self.chain_entries[-1]["block_hash"] if self.chain_entries else "0" * 64
        ts = time.time()
        payload = f"{index}|{record_hash}|{round_no}|{hospital_id}|{status_code}|{ts:.4f}|{prev_hash}"
        block_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        tx_hash = "0x" + hashlib.sha256(f"{index}:{block_hash}".encode()).hexdigest()

        entry = {
            "index": index,
            "record_hash": record_hash,
            "round": round_no,
            "hospital_id": hospital_id,
            "status_code": status_code,
            "status": CODE_TO_STATUS.get(status_code, "Unknown"),
            "timestamp": ts,
            "prev_hash": prev_hash,
            "block_hash": block_hash,
            "tx_hash": tx_hash,
        }
        self.chain_entries.append(entry)
        self._save()
        return entry

    def get_entries(self, limit: Optional[int] = None) -> List[Dict]:
        if limit is not None and limit > 0:
            return self.chain_entries[-limit:]
        return list(self.chain_entries)

    def entry_count(self) -> int:
        return len(self.chain_entries)

    def get_entry(self, index: int) -> Optional[Dict]:
        if 0 <= index < len(self.chain_entries):
            return self.chain_entries[index]
        return None


class LocalRecordStore:
    """Manages the local full decision records with tamper and restore capabilities."""

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or (config.APP_DIR / "blockchain" / "local_records.json")
        self.backup_path = config.APP_DIR / "blockchain" / "local_records_backup.json"
        self.records: List[Dict] = []
        self._load()

    def _load(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.records = json.load(f)
            except Exception:
                self.records = []
        else:
            self.records = []

    def _save(self):
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self.records, f, indent=2)

    def add_record(self, record: Dict) -> Tuple[int, str]:
        index = len(self.records)
        rec_copy = copy.deepcopy(record)
        rec_copy["index"] = index
        fp = canonical_fingerprint(rec_copy)
        rec_copy["fingerprint"] = fp
        self.records.append(rec_copy)
        self._save()

        # Update backup
        with open(self.backup_path, "w", encoding="utf-8") as f:
            json.dump(self.records, f, indent=2)

        return index, fp

    def get_records(self, limit: Optional[int] = None) -> List[Dict]:
        if limit is not None and limit > 0:
            return self.records[-limit:]
        return list(self.records)

    def tamper_record(self, index: int = 0) -> Dict:
        """Simulates unauthorized editing of local copy (e.g. flips Rejected to Accepted)."""
        if not self.records:
            return {"success": False, "message": "No local records to tamper with."}

        if index < 0 or index >= len(self.records):
            index = 0

        original_status = self.records[index]["status"]
        new_status = "Accepted" if original_status in ["Rejected", "Excluded"] else "Rejected"
        self.records[index]["status"] = new_status
        self._save()

        return {
            "success": True,
            "tampered_index": index,
            "original_status": original_status,
            "tampered_status": new_status,
            "message": f"Simulates someone editing stored records. Record #{index} local status altered to '{new_status}'. The blockchain itself cannot be edited.",
        }

    def restore_records(self) -> Dict:
        """Restores local records from backup."""
        if not self.backup_path.exists():
            return {"success": False, "message": "No backup found to restore from."}

        try:
            with open(self.backup_path, "r", encoding="utf-8") as f:
                self.records = json.load(f)
            self._save()
            return {"success": True, "message": "Local records successfully restored to match blockchain."}
        except Exception as e:
            return {"success": False, "message": f"Failed to restore: {e}"}

    def reset(self):
        self.records = []
        if self.storage_path.exists():
            self.storage_path.unlink()
        if self.backup_path.exists():
            self.backup_path.unlink()

