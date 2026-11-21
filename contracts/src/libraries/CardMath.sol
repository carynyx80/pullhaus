// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Deterministic card math shared with `packages/shared`.
/// Do not change the encoding without updating the TypeScript twin and the golden test.
library CardMath {
    struct Odds {
        uint16 common;
        uint16 rare;
        uint16 epic;
        uint16 legendary;
        uint16 mythic;
    }

    function sum(Odds memory o) internal pure returns (uint256) {
        return uint256(o.common) + o.rare + o.epic + o.legendary + o.mythic;
    }

    /// @dev Base stats before level scaling. Rarity 0 sits in the 30s; mythic clears 100.
    function derive(uint256 seed, uint8 rarity)
        internal
        pure
        returns (uint16 atk, uint16 def, uint16 spd, uint8 element, uint16 ability)
    {
        uint256 a = uint256(keccak256(abi.encode(seed, uint256(1))));
        uint256 b = uint256(keccak256(abi.encode(seed, uint256(2))));
        uint256 c = uint256(keccak256(abi.encode(seed, uint256(3))));
        element = uint8(seed % 5);
        ability = uint16(a % 12);
        uint256 base = 30 + uint256(rarity) * 18;
        uint256 spread = 20 + uint256(rarity) * 6;
        atk = uint16(base + (a % (spread + 1)));
        def = uint16(base + (b % (spread + 1)));
        spd = uint16(base + (c % (spread + 1)));
    }

    function scaled(uint16 baseStat, uint8 level) internal pure returns (uint16) {
        if (level == 0) level = 1;
        return uint16((uint256(baseStat) * (100 + (uint256(level) - 1) * 8)) / 100);
    }

    function roll(uint256 seed, Odds memory odds) internal pure returns (uint8) {
        uint256 ticket = uint256(keccak256(abi.encode(seed, uint256(99)))) % 10_000;
        uint256 cum = odds.common;
        if (ticket < cum) return 0;
        cum += odds.rare;
        if (ticket < cum) return 1;
        cum += odds.epic;
        if (ticket < cum) return 2;
        cum += odds.legendary;
        if (ticket < cum) return 3;
        return 4;
    }

    /// @dev Shift `boosts[tier]` out of common into rare (50%), epic (30%), legendary (rest).
    function applyTier(Odds memory o, uint16[5] memory boosts, uint8 tier) internal pure returns (Odds memory) {
        if (tier > 4) tier = 4;
        uint16 boost = boosts[tier];
        if (boost == 0 || o.common <= boost) return o;
        o.common -= boost;
        uint16 toRare = boost / 2;
        uint16 toEpic = uint16((uint256(boost) * 3) / 10);
        uint16 toLeg = boost - toRare - toEpic;
        o.rare += toRare;
        o.epic += toEpic;
        o.legendary += toLeg;
        return o;
    }
}
