// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PullhausRewards
/// @notice Burn points per wallet, burn tiers, seasons, and a pro-rata epoch pool.
/// Points are perks accounting. They are not a cash claim on anything except the tokens
/// that pack sales and marketplace fees actually deposited into the active epoch.
contract PullhausRewards is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    struct Epoch {
        uint64 start;
        uint64 end;
        uint256 pool;
        uint256 totalPoints;
        uint256 claimed;
        bool finalized;
    }

    IERC20 public immutable pull;
    bool public immutable localTools;

    mapping(address => uint256) public lifetimePoints;
    uint256 public totalLifetimePoints;
    uint256 public season = 1;
    mapping(uint256 => mapping(address => uint256)) public seasonPoints;

    uint256 public currentEpoch;
    uint256 public epochCount;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => uint256)) public epochPoints;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public pendingPool;

    /// @dev Index 0 is unused. Tiers 1–4 fire at these lifetime point totals.
    uint256[5] public tierThresholds;

    error ZeroAddress();
    error EpochStillOpen();
    error EpochMissing();
    error TooEarly();
    error AlreadyClaimed();
    error NothingToClaim();
    error BadThresholds();
    error LocalToolsDisabled();
    error PendingShortfall();

    event BurnAccrued(address indexed user, uint256 points, uint256 lifetimePoints, uint256 season, uint256 epochId);
    event PoolFunded(uint256 indexed epochId, uint256 amount);
    event EpochStarted(uint256 indexed epochId, uint64 start, uint64 end, uint256 pool);
    event EpochFinalized(uint256 indexed epochId, uint256 pool, uint256 totalPoints);
    event Claimed(uint256 indexed epochId, address indexed user, uint256 amount);
    event SeasonAdvanced(uint256 season);
    event ThresholdsSet(uint256 t1, uint256 t2, uint256 t3, uint256 t4);

    constructor(address admin, address pull_, bool localTools_) {
        if (admin == address(0) || pull_ == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        pull = IERC20(pull_);
        localTools = localTools_;
        tierThresholds[1] = 100 ether;
        tierThresholds[2] = 300 ether;
        tierThresholds[3] = 800 ether;
        tierThresholds[4] = 2_000 ether;
    }

    function accrue(address user, uint256 points) external onlyRole(GAME_ROLE) {
        if (points == 0 || user == address(0)) return;
        lifetimePoints[user] += points;
        totalLifetimePoints += points;
        seasonPoints[season][user] += points;

        uint256 eid = currentEpoch;
        if (eid != 0) {
            Epoch storage e = epochs[eid];
            if (!e.finalized && block.timestamp >= e.start && block.timestamp < e.end) {
                epochPoints[eid][user] += points;
                e.totalPoints += points;
            } else {
                eid = 0;
            }
        }
        emit BurnAccrued(user, points, lifetimePoints[user], season, eid);
    }

    function notifyFunding(uint256 amount) external onlyRole(GAME_ROLE) {
        if (amount == 0) return;
        uint256 eid = currentEpoch;
        if (eid != 0 && !epochs[eid].finalized && block.timestamp < epochs[eid].end) {
            epochs[eid].pool += amount;
        } else {
            pendingPool += amount;
            eid = 0;
        }
        emit PoolFunded(eid, amount);
    }

    function startEpoch(uint64 duration) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        if (duration == 0) revert EpochMissing();
        if (currentEpoch != 0 && !epochs[currentEpoch].finalized) revert EpochStillOpen();
        id = ++epochCount;
        uint256 pool = pendingPool;
        pendingPool = 0;
        epochs[id] = Epoch({
            start: uint64(block.timestamp),
            end: uint64(block.timestamp) + duration,
            pool: pool,
            totalPoints: 0,
            claimed: 0,
            finalized: false
        });
        currentEpoch = id;
        emit EpochStarted(id, epochs[id].start, epochs[id].end, pool);
    }

    function finalizeEpoch(uint256 id) external {
        Epoch storage e = epochs[id];
        if (e.end == 0 || e.finalized) revert EpochMissing();
        if (block.timestamp < e.end) revert TooEarly();
        e.finalized = true;
        if (currentEpoch == id) currentEpoch = 0;
        emit EpochFinalized(id, e.pool, e.totalPoints);
    }

    /// @notice Anvil-only helper so a local session can close an epoch without waiting out the week.
    function debugEndEpoch() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!localTools) revert LocalToolsDisabled();
        uint256 id = currentEpoch;
        if (id == 0) revert EpochMissing();
        epochs[id].end = uint64(block.timestamp);
    }

    function claim(uint256 epochId) external nonReentrant whenNotPaused {
        Epoch storage e = epochs[epochId];
        if (!e.finalized) revert EpochStillOpen();
        if (claimed[epochId][msg.sender]) revert AlreadyClaimed();
        uint256 pts = epochPoints[epochId][msg.sender];
        if (pts == 0 || e.totalPoints == 0) revert NothingToClaim();
        uint256 share = (e.pool * pts) / e.totalPoints;
        if (share == 0) revert NothingToClaim();
        claimed[epochId][msg.sender] = true;
        e.claimed += share;
        pull.safeTransfer(msg.sender, share);
        emit Claimed(epochId, msg.sender, share);
    }

    function claimable(uint256 epochId, address user) external view returns (uint256) {
        Epoch storage e = epochs[epochId];
        if (!e.finalized || claimed[epochId][user]) return 0;
        uint256 pts = epochPoints[epochId][user];
        if (pts == 0 || e.totalPoints == 0) return 0;
        return (e.pool * pts) / e.totalPoints;
    }

    function tierOf(address user) public view returns (uint8) {
        uint256 p = lifetimePoints[user];
        if (p >= tierThresholds[4]) return 4;
        if (p >= tierThresholds[3]) return 3;
        if (p >= tierThresholds[2]) return 2;
        if (p >= tierThresholds[1]) return 1;
        return 0;
    }

    function setTierThresholds(uint256 t1, uint256 t2, uint256 t3, uint256 t4) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!(t1 <= t2 && t2 <= t3 && t3 <= t4)) revert BadThresholds();
        tierThresholds[1] = t1;
        tierThresholds[2] = t2;
        tierThresholds[3] = t3;
        tierThresholds[4] = t4;
        emit ThresholdsSet(t1, t2, t3, t4);
    }

    function advanceSeason() external onlyRole(DEFAULT_ADMIN_ROLE) {
        season += 1;
        emit SeasonAdvanced(season);
    }

    function withdrawPending(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount > pendingPool) revert PendingShortfall();
        pendingPool -= amount;
        pull.safeTransfer(to, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
