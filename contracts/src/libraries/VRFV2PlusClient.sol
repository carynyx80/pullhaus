// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @notice Chainlink VRF v2.5 request shape. Kept byte-for-byte compatible with
/// https://github.com/smartcontractkit/chainlink VRFV2PlusClient so PullhausPacks
/// can call the BSC / BSC testnet coordinators without vendoring all of Chainlink.
library VRFV2PlusClient {
    bytes4 public constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function _argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
    }
}
