// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PullSettle} from "./libraries/PullSettle.sol";
import {PullhausCards} from "./PullhausCards.sol";
import {PullhausRewards} from "./PullhausRewards.sol";

/// @title PullhausForge
/// @notice Level a card by burning a duplicate, or fuse cards into the next rarity.
/// Mythic (rarity 4) is not in the pack table. It comes from sacrificing two legendaries,
/// or from burning a large token amount together with one legendary.
/// Fusion entropy is the keccak of the sacrificed VRF seeds, so it stays reproducible.
contract PullhausForge is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pull;
    PullhausCards public immutable cards;
    PullhausRewards public immutable rewards;
    address public treasury;

    uint16 public burnBps = 5_000;
    uint16 public rewardBps = 3_000;
    uint16 public treasuryBps = 2_000;
    bool public useDeadBurn;

    uint256 public upgradeBase = 50 ether;
    uint256 public fuseBase = 75 ether;
    uint256 public mythicBurnPrice = 25_000 ether;
    uint256 public fuseNonce;

    error ZeroAddress();
    error NotOwner();
    error BadInput();
    error RarityMismatch();
    error LevelCap();

    event Upgraded(address indexed user, uint256 indexed keepId, uint256 burnedId, uint8 newLevel);
    event Fused(address indexed user, uint256[] burnedIds, uint256 indexed mintedId, uint8 rarity);
    event CostsSet(uint256 upgradeBase, uint256 fuseBase, uint256 mythicBurnPrice);

    constructor(address admin, address pull_, address cards_, address rewards_, address treasury_, bool useDead_) {
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
    }

    function upgrade(uint256 keepId, uint256 burnId) external nonReentrant whenNotPaused {
        if (keepId == burnId) revert BadInput();
        if (cards.ownerOf(keepId) != msg.sender || cards.ownerOf(burnId) != msg.sender) revert NotOwner();
        PullhausCards.Card memory keep = cards.gameCard(keepId);
        PullhausCards.Card memory sacrifice = cards.gameCard(burnId);
        if (keep.rarity != sacrifice.rarity) revert RarityMismatch();
        if (keep.level >= 20) revert LevelCap();

        _pay(upgradeBase * keep.level);
        cards.burnCard(burnId);
        cards.levelUp(keepId);
        emit Upgraded(msg.sender, keepId, burnId, keep.level + 1);
    }

    /// @param ids 3 cards below legendary, 2 legendaries, or 1 legendary (paid with `mythicBurnPrice`).
    function fuse(uint256[] calldata ids) external nonReentrant whenNotPaused {
        uint256 n = ids.length;
        if (n != 1 && n != 2 && n != 3) revert BadInput();
        for (uint256 i; i < n; i++) {
            for (uint256 j = i + 1; j < n; j++) {
                if (ids[i] == ids[j]) revert BadInput();
            }
        }

        uint8 rarity = _sameRarity(ids);
        uint8 nextRarity;
        uint256 price;
        if (n == 3) {
            if (rarity >= 3) revert BadInput();
            nextRarity = rarity + 1;
            price = fuseBase * (uint256(rarity) + 1);
        } else if (n == 2) {
            if (rarity != 3) revert BadInput();
            nextRarity = 4;
            price = fuseBase * 8;
        } else {
            if (rarity != 3) revert BadInput();
            nextRarity = 4;
            price = mythicBurnPrice;
        }

        _pay(price);
        uint256 seedAcc = uint256(keccak256(abi.encode(msg.sender, ++fuseNonce)));
        uint32 setId;
        for (uint256 i; i < n; i++) {
            PullhausCards.Card memory c = cards.gameCard(ids[i]);
            seedAcc = uint256(keccak256(abi.encode(seedAcc, ids[i], c.seed)));
            if (i == 0) setId = c.setId;
            cards.burnCard(ids[i]);
        }
        uint256 minted = cards.mintSealed(msg.sender, nextRarity, seedAcc, setId);
        emit Fused(msg.sender, ids, minted, nextRarity);
    }

    function _sameRarity(uint256[] calldata ids) internal view returns (uint8 rarity) {
        for (uint256 i; i < ids.length; i++) {
            if (cards.ownerOf(ids[i]) != msg.sender) revert NotOwner();
            PullhausCards.Card memory c = cards.gameCard(ids[i]);
            if (i == 0) rarity = c.rarity;
            else if (c.rarity != rarity) revert RarityMismatch();
        }
    }

    function _pay(uint256 price) internal {
        if (price == 0) return;
        pull.safeTransferFrom(msg.sender, address(this), price);
        (uint256 burnAmt, uint256 rewardAmt, uint256 treasuryAmt) = PullSettle.amounts(price, burnBps, rewardBps);
        PullSettle.burn(pull, burnAmt, useDeadBurn);
        if (rewardAmt > 0) {
            pull.safeTransfer(address(rewards), rewardAmt);
            rewards.notifyFunding(rewardAmt);
        }
        if (treasuryAmt > 0) pull.safeTransfer(treasury, treasuryAmt);
        if (burnAmt > 0) rewards.accrue(msg.sender, burnAmt);
    }

    function setCosts(uint256 upgradeBase_, uint256 fuseBase_, uint256 mythicBurnPrice_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        upgradeBase = upgradeBase_;
        fuseBase = fuseBase_;
        mythicBurnPrice = mythicBurnPrice_;
        emit CostsSet(upgradeBase_, fuseBase_, mythicBurnPrice_);
    }

    function setSplit(uint16 burn_, uint16 reward_, uint16 treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        PullSettle.validate(burn_, reward_, treasury_);
        burnBps = burn_;
        rewardBps = reward_;
        treasuryBps = treasury_;
    }

    function setUseDeadBurn(bool next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        useDeadBurn = next;
    }

    function setTreasury(address next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (next == address(0)) revert ZeroAddress();
        treasury = next;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
