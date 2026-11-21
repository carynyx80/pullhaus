// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VRFV2PlusClient} from "./libraries/VRFV2PlusClient.sol";
import {VRFConsumerBase} from "./VRFConsumerBase.sol";

/// @notice Local / opBNB-testnet stand-in for Chainlink VRF v2.5.
///
/// SECURITY: this coordinator is not production randomness. `fulfill` (owner) can choose words.
/// `fulfillDeterministic` is permissionless and is only enabled when `publicFulfill` is set at
/// deploy, so a local wallet can finish a pack without an oracle. Do not deploy it on BSC mainnet.
/// BSC and BSC testnet use the real Chainlink coordinator (see script/Deploy.s.sol).
contract MockVRFCoordinator is Ownable {
    event RandomWordsRequested(uint256 indexed requestId, address indexed consumer);
    event RandomWordsFulfilled(uint256 indexed requestId, address indexed consumer);

    struct Req {
        address consumer;
        uint32 numWords;
        bool open;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => Req) public requests;
    uint256[] private _pending;
    bool public immutable publicFulfill;

    error UnknownRequest(uint256 requestId);
    error PublicFulfillDisabled();
    error BadWords();

    constructor(address owner_, bool publicFulfill_) Ownable(owner_) {
        publicFulfill = publicFulfill_;
    }

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        uint32 n = req.numWords == 0 ? 1 : req.numWords;
        requests[requestId] = Req({consumer: msg.sender, numWords: n, open: true});
        _pending.push(requestId);
        emit RandomWordsRequested(requestId, msg.sender);
    }

    function pendingCount() external view returns (uint256) {
        return _pending.length;
    }

    function pendingAt(uint256 index) external view returns (uint256) {
        return _pending[index];
    }

    function fulfill(uint256 requestId, uint256[] calldata words) external onlyOwner {
        _fulfill(requestId, words);
    }

    function fulfillDeterministic(uint256 requestId) external {
        if (!publicFulfill) revert PublicFulfillDisabled();
        Req memory r = requests[requestId];
        if (!r.open) revert UnknownRequest(requestId);
        uint256[] memory words = new uint256[](r.numWords);
        for (uint256 i; i < words.length; i++) {
            words[i] = uint256(keccak256(abi.encode(requestId, i, block.prevrandao)));
        }
        _fulfill(requestId, words);
    }

    function _fulfill(uint256 requestId, uint256[] memory words) internal {
        Req memory r = requests[requestId];
        if (!r.open) revert UnknownRequest(requestId);
        if (words.length < r.numWords) revert BadWords();
        requests[requestId].open = false;
        _removePending(requestId);
        VRFConsumerBase(r.consumer).rawFulfillRandomWords(requestId, words);
        emit RandomWordsFulfilled(requestId, r.consumer);
    }

    function _removePending(uint256 requestId) internal {
        uint256 len = _pending.length;
        for (uint256 i; i < len; i++) {
            if (_pending[i] == requestId) {
                _pending[i] = _pending[len - 1];
                _pending.pop();
                return;
            }
        }
    }
}
