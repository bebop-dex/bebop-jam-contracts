// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../libraries/JamTransfer.sol";

/// @title IJamBalanceManager
/// @notice User approvals are made here. This handles the complexity of multiple allowance types. 
interface IJamBalanceManager {
    /// @dev Transfer from this contract to another
    /// 
    /// @notice TODO: this function should optionally take permit data so instead of regular transfer it would do permit2
    /// 
    /// @param from address to transfer form
    /// @param info JamTransfer.Initial info about transfer receiver and type of transfer
    /// @param tokens tokens' addresses
    /// @param amounts tokens' amounts
    function transferTokens(address from, JamTransfer.Initial calldata info, address[] calldata tokens, uint256[] calldata amounts) external;
}