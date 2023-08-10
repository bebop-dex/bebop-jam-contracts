// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../libraries/JamTransfer.sol";

/// @title IJamBalanceManager
/// @notice User approvals are made here. This handles the complexity of multiple allowance types. 
interface IJamBalanceManager {
    /// @dev Transfer from this contract to another
    ///
    /// @param from address to transfer form
    /// @param receiver address
    /// @param tokens tokens' addresses
    /// @param amounts tokens' amounts
    /// @param nftIds NFTs' ids
    /// @param transferTypes command sequence of transfer types
    function transferTokens(
        address from,
        address receiver,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata nftIds,
        bytes calldata transferTypes
    ) external;
}