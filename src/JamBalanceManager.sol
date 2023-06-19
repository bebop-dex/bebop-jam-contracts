// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./interfaces/IJamBalanceManager.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title JamBalanceManager
/// @notice The reason a balance manager exists is to prevent interaction to the settlement contract draining user funds
/// By having another contract that allowances are made to, we can enforce that it is only used to draw in user balances to settlement and not sent out
contract JamBalanceManager is IJamBalanceManager {
    address operator;

    using SafeERC20 for IERC20;

    constructor(address _operator) {
        // Operator can be defined at creation time with `msg.sender` 
        // Pass in the settlement - and that can be the only caller.
        operator = _operator;
    }

    modifier onlyOperator(address account) {
        require(account == operator, "INVALID_CALLER");
        _;
    }

    /// @inheritdoc IJamBalanceManager
    function transfer(address from, address to, IERC20 token, uint256 amount) onlyOperator(msg.sender) external {
        // Will need to handler other allowance types
        // It can also have internal balances
        token.safeTransferFrom(from, to, amount);
    }
}