// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @title IJamBalanceManager
/// @notice User approvals are made here. This handles the complexity of multiple allowance types. 
interface IJamBalanceManager {
    /// @dev Transfer from this contract to another
    /// 
    /// @notice TODO: this function should optionally take permit data so instead of regular transfer it would do permit2
    /// 
    /// @param from address to transfer form
    /// @param to address to transfer to
    /// @param token the erc20 token
    /// @param amount the amount of the token
    function transfer(address from, address to, IERC20 token, uint256 amount) external;
}