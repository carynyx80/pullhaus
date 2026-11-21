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

/// @title PullhausMarketplace
/// @notice Escrow listings for revealed cards. The fee (not the whole price) is split
/// across burn, the reward pool, and the treasury. Sealed cards cannot be listed.
contract PullhausMarketplace is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    IERC20 public immutable pull;
    PullhausCards public immutable cards;
    PullhausRewards public immutable rewards;
    address public treasury;

    uint16 public feeBps = 500;
    uint16 public burnBps = 5_000;
    uint16 public rewardBps = 3_000;
    uint16 public treasuryBps = 2_000;
    bool public useDeadBurn;

    mapping(uint256 => Listing) public listings;

    error ZeroAddress();
    error BadPrice();
    error NotSeller();
    error SealedCard();
    error ListingInactive();
    error SelfBuy();
    error FeeTooHigh();

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 burned);
    event SplitUpdated(uint16 feeBps, uint16 burnBps, uint16 rewardBps, uint16 treasuryBps);

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

    function list(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        if (price == 0) revert BadPrice();
        if (cards.ownerOf(tokenId) != msg.sender) revert NotSeller();
        if (!cards.isRevealed(tokenId)) revert SealedCard();
        cards.transferFrom(msg.sender, address(this), tokenId);
        listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        emit Listed(tokenId, msg.sender, price);
    }

    function cancel(uint256 tokenId) external nonReentrant {
        Listing memory item = listings[tokenId];
        if (!item.active || item.seller != msg.sender) revert ListingInactive();
        listings[tokenId].active = false;
        cards.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Cancelled(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory item = listings[tokenId];
        if (!item.active) revert ListingInactive();
        if (item.seller == msg.sender) revert SelfBuy();
        listings[tokenId].active = false;

        pull.safeTransferFrom(msg.sender, address(this), item.price);
        uint256 fee = (item.price * feeBps) / 10_000;
        uint256 sellerAmt = item.price - fee;
        (uint256 burnAmt, uint256 rewardAmt, uint256 treasuryAmt) = PullSettle.amounts(fee, burnBps, rewardBps);
        PullSettle.burn(pull, burnAmt, useDeadBurn);
        if (rewardAmt > 0) {
            pull.safeTransfer(address(rewards), rewardAmt);
            rewards.notifyFunding(rewardAmt);
        }
        if (treasuryAmt > 0) pull.safeTransfer(treasury, treasuryAmt);
        if (sellerAmt > 0) pull.safeTransfer(item.seller, sellerAmt);
        if (burnAmt > 0) rewards.accrue(msg.sender, burnAmt);
        cards.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Sold(tokenId, item.seller, msg.sender, item.price, burnAmt);
    }

    function setSplit(uint16 fee_, uint16 burn_, uint16 reward_, uint16 treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (fee_ > 2_000) revert FeeTooHigh();
        PullSettle.validate(burn_, reward_, treasury_);
        feeBps = fee_;
        burnBps = burn_;
        rewardBps = reward_;
        treasuryBps = treasury_;
        emit SplitUpdated(fee_, burn_, reward_, treasury_);
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
