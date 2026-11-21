// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Splits a token amount into burn / reward / treasury. The treasury leg is the remainder
/// so the three pieces always sum to `amount` (no wei left on the caller).
library PullSettle {
    using SafeERC20 for IERC20;

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    error BurnFailed();
    error InvalidSplit();

    function amounts(uint256 amount, uint16 burnBps, uint16 rewardBps)
        internal
        pure
        returns (uint256 burnAmt, uint256 rewardAmt, uint256 treasuryAmt)
    {
        burnAmt = (amount * burnBps) / 10_000;
        rewardAmt = (amount * rewardBps) / 10_000;
        treasuryAmt = amount - burnAmt - rewardAmt;
    }

    function validate(uint16 burnBps, uint16 rewardBps, uint16 treasuryBps) internal pure {
        if (uint256(burnBps) + rewardBps + treasuryBps != 10_000) revert InvalidSplit();
    }

    /// @param useDead When true, tokens go to the dead address. When false, call `burn(uint256)`
    /// on the token (MockPULL and any BEP-20 that burns the caller's balance).
    function burn(IERC20 token, uint256 amount, bool useDead) internal {
        if (amount == 0) return;
        if (useDead) {
            token.safeTransfer(DEAD, amount);
            return;
        }
        (bool ok, bytes memory data) = address(token).call(abi.encodeWithSelector(bytes4(keccak256("burn(uint256)")), amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert BurnFailed();
    }
}
