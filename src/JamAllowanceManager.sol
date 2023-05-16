// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./interfaces/IJamAllowanceManager.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract JamAllownaceManager is IJamAllowanceManager {
    address operator;

    using SafeERC20 for IERC20;

    constructor() {
        // Operator can be defined at creation time with `msg.sender` 
        // Pass in the settlement - and that can be the only caller.
    }

    modifier onlyOperator(address account) {
        require(account == operator, "INVALID_CALLER");
        _;
    }

    /// @inheritdoc IJamAllowanceManager
    function transfer(address from, address to, IERC20 token, uint256 amount) onlyOperator(msg.sender) external {
        token.safeTransferFrom(from, to, amount);
    }
}