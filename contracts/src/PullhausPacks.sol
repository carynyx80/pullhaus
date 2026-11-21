// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {VRFConsumerBase} from "./VRFConsumerBase.sol";
import {VRFV2PlusClient} from "./libraries/VRFV2PlusClient.sol";
import {IVRFCoordinatorV2Plus} from "./interfaces/IVRFCoordinatorV2Plus.sol";
import {CardMath} from "./libraries/CardMath.sol";
import {PullSettle} from "./libraries/PullSettle.sol";
import {PullhausCards} from "./PullhausCards.sol";
import {PullhausRewards} from "./PullhausRewards.sol";

/// @title PullhausPacks
/// @notice Burn $PULL to request a sealed pack. Chainlink VRF v2.5 (or the local mock) rolls rarity.
/// Mythic stays at 0 in the default table; mythics are forged, not pulled.
contract PullhausPacks is AccessControl, ReentrancyGuard, Pausable, VRFConsumerBase {
    using SafeERC20 for IERC20;

    struct PackType {
        string name;
        uint256 price;
        uint8 count;
        uint32 setId;
        uint8 minTier;
        uint64 startTime;
        uint64 earlyWindow;
        bool active;
    }

    struct Request {
        address user;
        uint256 packId;
        uint256 burned;
        uint8 count;
        uint8 tier;
        uint32 setId;
        bool done;
    }

    IERC20 public immutable pull;
    PullhausCards public immutable cards;
    PullhausRewards public immutable rewards;
    address public treasury;

    uint16 public burnBps = 5_000;
    uint16 public rewardBps = 3_000;
    uint16 public treasuryBps = 2_000;
    bool public useDeadBurn;
    uint256 public totalBurned;

    CardMath.Odds public baseOdds;
    uint16[5] public tierBoostBps;
    mapping(uint256 => PackType) public packTypes;
    uint256[] private _packIds;
    mapping(uint256 => bool) private _knownPack;

    mapping(uint256 => Request) public requests;
    uint256 public lastRequestId;

    bytes32 public keyHash;
    uint256 public subId;
    uint16 public confirmations = 3;
    uint32 public callbackGasLimit = 2_000_000;
    bool public nativePayment = true;

    error ZeroAddress();
    error PackClosed();
    error TierLocked();
    error TooEarly();
    error InvalidOdds();
    error BadBoost();
    error BadCount();
    error BadRequest();

    event PackConfigured(uint256 indexed packId, string name, uint256 price, uint8 count, bool active);
    event OddsUpdated(uint16 common, uint16 rare, uint16 epic, uint16 legendary, uint16 mythic);
    event SplitUpdated(uint16 burnBps, uint16 rewardBps, uint16 treasuryBps);
    event PackRequested(
        uint256 indexed requestId, address indexed user, uint256 indexed packId, uint256 price, uint256 burned
    );
    event PackFulfilled(uint256 indexed requestId, address indexed user, uint256[] tokenIds);

    constructor(
        address admin,
        address pull_,
        address cards_,
        address rewards_,
        address treasury_,
        address coordinator,
        bool useDead_
    ) VRFConsumerBase(coordinator) {
        if (admin == address(0) || pull_ == address(0) || cards_ == address(0) || rewards_ == address(0) || treasury_ == address(0))
        {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        pull = IERC20(pull_);
        cards = PullhausCards(cards_);
        rewards = PullhausRewards(rewards_);
        treasury = treasury_;
        useDeadBurn = useDead_;
        baseOdds = CardMath.Odds({common: 6200, rare: 2600, epic: 1000, legendary: 200, mythic: 0});
        tierBoostBps[1] = 150;
        tierBoostBps[2] = 300;
        tierBoostBps[3] = 500;
        tierBoostBps[4] = 800;
    }

    function openPack(uint256 packId) external nonReentrant whenNotPaused returns (uint256 requestId) {
        PackType memory p = packTypes[packId];
        if (!p.active || p.price == 0 || p.count == 0) revert PackClosed();
        uint8 tier = rewards.tierOf(msg.sender);
        if (tier < p.minTier) revert TierLocked();
        if (block.timestamp < p.startTime) {
            bool early = p.earlyWindow > 0 && tier >= 4 && block.timestamp + p.earlyWindow >= p.startTime;
            if (!early) revert TooEarly();
        }

        pull.safeTransferFrom(msg.sender, address(this), p.price);
        (uint256 burnAmt, uint256 rewardAmt, uint256 treasuryAmt) = PullSettle.amounts(p.price, burnBps, rewardBps);
        PullSettle.burn(pull, burnAmt, useDeadBurn);
        if (rewardAmt > 0) {
            pull.safeTransfer(address(rewards), rewardAmt);
            rewards.notifyFunding(rewardAmt);
        }
        if (treasuryAmt > 0) pull.safeTransfer(treasury, treasuryAmt);
        if (burnAmt > 0) rewards.accrue(msg.sender, burnAmt);
        totalBurned += burnAmt;

        requestId = IVRFCoordinatorV2Plus(vrfCoordinator).requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subId,
                requestConfirmations: confirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment}))
            })
        );

        requests[requestId] = Request({
            user: msg.sender,
            packId: packId,
            burned: burnAmt,
            count: p.count,
            tier: tier,
            setId: p.setId,
            done: false
        });
        lastRequestId = requestId;
        emit PackRequested(requestId, msg.sender, packId, p.price, burnAmt);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        Request storage r = requests[requestId];
        if (r.user == address(0) || r.done || randomWords.length == 0) revert BadRequest();
        r.done = true;

        uint16[5] memory boosts = tierBoostBps;
        CardMath.Odds memory odds = CardMath.applyTier(baseOdds, boosts, r.tier);
        uint256[] memory ids = new uint256[](r.count);
        for (uint256 i; i < r.count; i++) {
            uint256 seed = uint256(keccak256(abi.encode(randomWords[0], requestId, i)));
            uint8 rarity = CardMath.roll(seed, odds);
            ids[i] = cards.mintSealed(r.user, rarity, seed, r.setId);
        }
        emit PackFulfilled(requestId, r.user, ids);
    }

    function oddsFor(address user) external view returns (CardMath.Odds memory) {
        uint16[5] memory boosts = tierBoostBps;
        return CardMath.applyTier(baseOdds, boosts, rewards.tierOf(user));
    }

    function tierBoostsView() external view returns (uint16[5] memory) {
        return tierBoostBps;
    }

    function allPackIds() external view returns (uint256[] memory) {
        return _packIds;
    }

    function setPack(
        uint256 id,
        string calldata name,
        uint256 price,
        uint8 count,
        uint32 setId,
        uint8 minTier,
        uint64 startTime,
        uint64 earlyWindow,
        bool active
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (count == 0 || count > 10) revert BadCount();
        if (minTier > 4) revert TierLocked();
        if (!_knownPack[id]) {
            _knownPack[id] = true;
            _packIds.push(id);
        }
        packTypes[id] = PackType({
            name: name,
            price: price,
            count: count,
            setId: setId,
            minTier: minTier,
            startTime: startTime,
            earlyWindow: earlyWindow,
            active: active
        });
        emit PackConfigured(id, name, price, count, active);
    }

    function setOdds(CardMath.Odds calldata next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (CardMath.sum(next) != 10_000) revert InvalidOdds();
        baseOdds = next;
        emit OddsUpdated(next.common, next.rare, next.epic, next.legendary, next.mythic);
    }

    function setTierBoosts(uint16[5] calldata boosts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < 5; i++) {
            if (boosts[i] > 3_000) revert BadBoost();
        }
        tierBoostBps = boosts;
    }

    function setSplit(uint16 burn_, uint16 reward_, uint16 treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        PullSettle.validate(burn_, reward_, treasury_);
        burnBps = burn_;
        rewardBps = reward_;
        treasuryBps = treasury_;
        emit SplitUpdated(burn_, reward_, treasury_);
    }

    function setUseDeadBurn(bool next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        useDeadBurn = next;
    }

    function setTreasury(address next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (next == address(0)) revert ZeroAddress();
        treasury = next;
    }

    function setVrf(bytes32 keyHash_, uint256 subId_, uint16 confirmations_, uint32 gasLimit_, bool nativePayment_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (confirmations_ == 0 || gasLimit_ < 200_000) revert BadRequest();
        keyHash = keyHash_;
        subId = subId_;
        confirmations = confirmations_;
        callbackGasLimit = gasLimit_;
        nativePayment = nativePayment_;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
