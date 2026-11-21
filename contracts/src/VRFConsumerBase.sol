// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Consumer half of Chainlink VRF v2.5. The coordinator calls
/// `rawFulfillRandomWords`; only that coordinator address is accepted.
abstract contract VRFConsumerBase {
    address public immutable vrfCoordinator;

    error OnlyCoordinator(address have, address want);

    constructor(address coordinator) {
        if (coordinator == address(0)) revert OnlyCoordinator(address(0), address(0));
        vrfCoordinator = coordinator;
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != vrfCoordinator) revert OnlyCoordinator(msg.sender, vrfCoordinator);
        fulfillRandomWords(requestId, randomWords);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal virtual;
}
