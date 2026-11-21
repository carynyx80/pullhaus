// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFV2PlusClient} from "../libraries/VRFV2PlusClient.sol";

/// @notice Minimal BSC Chainlink VRF v2.5 coordinator surface used by Pullhaus.
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId);

    function addConsumer(uint256 subId, address consumer) external;
}
