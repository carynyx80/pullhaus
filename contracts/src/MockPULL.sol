// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice Local and testnet stand-in for the external $PULL BEP-20.
/// Production reads the real token address from env. There is no launchpad here.
contract MockPULL is ERC20, ERC20Burnable {
    uint256 public constant FAUCET_AMOUNT = 10_000 ether;

    constructor() ERC20("Pullhaus Token", "PULL") {}

    /// @dev Unlimited calls by design so local play and tests are not throttled.
    /// A public mainnet token must not use this contract.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
