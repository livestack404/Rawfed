"""Blockchain Audit Logger with automatic Ganache detection and cryptographic mock fallback.

Per 4.5 Ledger design:
- Full decision records live in local store (LocalRecordStore).
- Only record fingerprint (SHA-256 of canonical JSON) + round + hospital_id + status code goes on chain.
- Ganache contract: logEntry(bytes32 recordHash, uint16 round, string hospitalId, uint8 status),
  entryCount(), getEntry(index).
- Verify recomputes each local record fingerprint and compares with the chain entry.
- Tamper demo edits local copy only (never modifies chain).
- Restore reverts local copy.
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app import config
from app.blockchain.mock_ledger import (
    MockLedger,
    LocalRecordStore,
    canonical_fingerprint,
    STATUS_TO_CODE,
    CODE_TO_STATUS,
)

logger = logging.getLogger(__name__)


class BlockchainLogger:
    def __init__(self, ganache_url: str = config.GANACHE_URL):
        self.ganache_url = ganache_url
        self.mode = "mock"  # "ganache" or "mock"
        self.contract = None
        self.web3 = None
        self.account = None
        self.contract_address = None
        self.mock_ledger = MockLedger()
        self.local_store = LocalRecordStore()

        self._init_connection()

    def _init_connection(self):
        """Attempt to connect to Ganache; fallback to mock chain if unavailable."""
        try:
            from web3 import Web3
            self.web3 = Web3(Web3.HTTPProvider(self.ganache_url))
            if self.web3.is_connected():
                accounts = self.web3.eth.accounts
                if accounts:
                    self.account = accounts[config.DEPLOY_ACCOUNT_INDEX]
                    self.web3.eth.default_account = self.account
                    addr = self._load_persisted_address()
                    artifact = self._load_artifact()
                    if addr and artifact:
                        try:
                            self.contract = self.web3.eth.contract(
                                address=Web3.to_checksum_address(addr),
                                abi=artifact["abi"],
                            )
                            self.contract.functions.entryCount().call()
                            self.contract_address = addr
                            self.mode = "ganache"
                            logger.info(f"Connected to Ganache at {self.ganache_url}, contract: {addr}")
                            return
                        except Exception as e:
                            logger.warning(f"Failed to bind existing contract ({e}), deploying new...")

                    if artifact:
                        new_addr = self._deploy_contract(artifact)
                        if new_addr:
                            self.contract_address = new_addr
                            self.mode = "ganache"
                            return

            logger.info("Ganache node not detected. Using Local ledger (simulated chain).")
            self.mode = "mock"
        except Exception as e:
            logger.info(f"Web3 init failed ({e}). Using Local ledger (simulated chain).")
            self.mode = "mock"

    def _load_artifact(self) -> Optional[Dict]:
        artifact_path = config.BLOCKCHAIN_DIR / "contract_artifact.json"
        if artifact_path.exists():
            try:
                with open(artifact_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def _load_persisted_address(self) -> Optional[str]:
        if config.CONTRACT_ADDRESS_FILE.exists():
            try:
                with open(config.CONTRACT_ADDRESS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("address")
            except Exception:
                return None
        return None

    def _save_persisted_address(self, address: str):
        with open(config.CONTRACT_ADDRESS_FILE, "w", encoding="utf-8") as f:
            json.dump({"address": address, "network": self.ganache_url}, f, indent=2)

    def _deploy_contract(self, artifact: Dict) -> Optional[str]:
        try:
            AuditContract = self.web3.eth.contract(
                abi=artifact["abi"], bytecode=artifact["bytecode"]
            )
            tx_hash = AuditContract.constructor().transact({"from": self.account})
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            addr = receipt.contractAddress
            self._save_persisted_address(addr)
            self.contract = self.web3.eth.contract(address=addr, abi=artifact["abi"])
            logger.info(f"Deployed new AuditLog contract to Ganache at {addr}")
            return addr
        except Exception as e:
            logger.warning(f"Contract auto-deployment failed: {e}")
            return None

    def log_decision_record(self, record: Dict) -> Dict:
        """Stores full record in local store, and records fingerprint on blockchain."""
        index, fp_hex = self.local_store.add_record(record)
        round_no = int(record.get("round", 1))
        hospital_id = str(record.get("hospital_id", record.get("client_id", 0)))
        status_str = record.get("status", "Accepted")
        status_code = STATUS_TO_CODE.get(status_str, 1)

        # Record to mock fallback ledger
        mock_entry = self.mock_ledger.add_entry(
            record_hash=fp_hex,
            round_no=round_no,
            hospital_id=hospital_id,
            status_code=status_code,
        )

        tx_hex = None
        if self.mode == "ganache" and self.contract is not None:
            try:
                from web3 import Web3
                fp_bytes = bytes.fromhex(fp_hex)
                fn = self.contract.functions.logEntry(
                    fp_bytes,
                    round_no,
                    hospital_id,
                    status_code,
                )
                tx_hash = fn.transact({"from": self.account})
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
                tx_hex = Web3.to_hex(receipt.transactionHash)
            except Exception as e:
                logger.error(f"Ganache transaction failed ({e}). Degraded to mock chain.")
                self.mode = "mock"

        return {
            "index": index,
            "fingerprint": fp_hex,
            "round": round_no,
            "hospital_id": hospital_id,
            "status": status_str,
            "tx_hash": tx_hex or mock_entry.get("tx_hash"),
            "mode": self.mode,
        }

    # Backward compatibility helper for orchestrator
    def log_entry(self, round_no: int, client_id: int, update_hash: str, status: str, similarity: float) -> Dict:
        rec = {
            "round": round_no,
            "hospital_id": f"H{client_id+1}" if isinstance(client_id, int) else str(client_id),
            "client_id": client_id,
            "status": status,
            "cosine_similarity": similarity,
            "update_hash": update_hash,
        }
        return self.log_decision_record(rec)

    def get_entries(self, limit: Optional[int] = None) -> List[Dict]:
        """Returns full local records combined with blockchain status."""
        records = self.local_store.get_records(limit)
        return records

    def verify_integrity(self) -> Dict:
        """Verifies local records against blockchain fingerprints at each index."""
        local_records = self.local_store.get_records()
        total = len(local_records)
        if total == 0:
            return {
                "valid": True,
                "message": "All 0 entries intact",
                "total_entries": 0,
                "mode": self.mode,
                "mode_badge": "Ganache (local blockchain)" if self.mode == "ganache" else "Local ledger (simulated chain)",
            }

        mismatches = []

        if self.mode == "ganache" and self.contract is not None:
            try:
                chain_count = self.contract.functions.entryCount().call()
                for i, rec in enumerate(local_records):
                    if i >= chain_count:
                        mismatches.append({
                            "index": i,
                            "reason": f"Record {i} not found on blockchain (chain has {chain_count} entries)",
                        })
                        continue

                    # On-chain entry
                    c_hash_bytes, c_round, c_hosp, c_status, c_ts = self.contract.functions.getEntry(i).call()
                    chain_fp = c_hash_bytes.hex()
                    # Recompute local record fingerprint
                    local_fp = canonical_fingerprint(rec)
                    if chain_fp.lower() != local_fp.lower():
                        mismatches.append({
                            "index": i,
                            "reason": f"Record {i} does not match the blockchain",
                            "expected_blockchain_fingerprint": chain_fp,
                            "actual_local_fingerprint": local_fp,
                            "local_record": rec,
                        })
            except Exception as e:
                logger.warning(f"Error querying Ganache ({e}), falling back to mock ledger check.")
                mismatches = self._verify_against_mock(local_records)
        else:
            mismatches = self._verify_against_mock(local_records)

        valid = len(mismatches) == 0
        message = f"All {total} entries intact" if valid else f"Record {mismatches[0]['index']} does not match the blockchain"

        return {
            "valid": valid,
            "message": message,
            "total_entries": total,
            "mismatch_count": len(mismatches),
            "mismatches": mismatches,
            "mode": self.mode,
            "mode_badge": "Ganache (local blockchain)" if self.mode == "ganache" else "Local ledger (simulated chain)",
        }

    def _verify_against_mock(self, local_records: List[Dict]) -> List[Dict]:
        mismatches = []
        chain_count = self.mock_ledger.entry_count()
        for i, rec in enumerate(local_records):
            chain_entry = self.mock_ledger.get_entry(i)
            if not chain_entry:
                mismatches.append({"index": i, "reason": f"Record {i} does not match the blockchain"})
                continue
            local_fp = canonical_fingerprint(rec)
            if chain_entry["record_hash"] != local_fp:
                mismatches.append({
                    "index": i,
                    "reason": f"Record {i} does not match the blockchain",
                    "expected_blockchain_fingerprint": chain_entry["record_hash"],
                    "actual_local_fingerprint": local_fp,
                })
        return mismatches

    def tamper_attempt(self, index: int = 0) -> Dict:
        """Edits the local copy only (e.g. flips Rejected to Accepted)."""
        return self.local_store.tamper_record(index)

    def restore_attempt(self) -> Dict:
        """Reverts the local copy from backup."""
        return self.local_store.restore_records()

    def reset(self):
        self.mock_ledger.reset()
        self.local_store.reset()

