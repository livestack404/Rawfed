// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title AntiFLearning Audit Log Contract
/// @notice Records fingerprints of federated learning contribution decisions.
/// @dev Raw model weights and images are NEVER stored on-chain. Only hashes, round, hospitalId, and status code.
contract AuditLog {
    struct Entry {
        bytes32 recordHash;
        uint16 round;
        string hospitalId;
        uint8 status;
        uint256 timestamp;
    }

    Entry[] public entries;

    event EntryLogged(
        uint256 indexed index,
        bytes32 indexed recordHash,
        uint16 round,
        string hospitalId,
        uint8 status,
        uint256 timestamp
    );

    /// @notice Appends a decision record fingerprint to the immutable blockchain ledger.
    function logEntry(
        bytes32 recordHash,
        uint16 round,
        string calldata hospitalId,
        uint8 status
    ) external returns (uint256) {
        entries.push(
            Entry({
                recordHash: recordHash,
                round: round,
                hospitalId: hospitalId,
                status: status,
                timestamp: block.timestamp
            })
        );
        uint256 index = entries.length - 1;
        emit EntryLogged(index, recordHash, round, hospitalId, status, block.timestamp);
        return index;
    }

    /// @notice Returns the total count of logged entries.
    function entryCount() external view returns (uint256) {
        return entries.length;
    }

    /// @notice Retrieves an entry by index.
    function getEntry(uint256 index)
        external
        view
        returns (
            bytes32 recordHash,
            uint16 round,
            string memory hospitalId,
            uint8 status,
            uint256 timestamp
        )
    {
        require(index < entries.length, "Index out of bounds");
        Entry storage e = entries[index];
        return (
            e.recordHash,
            e.round,
            e.hospitalId,
            e.status,
            e.timestamp
        );
    }
}
