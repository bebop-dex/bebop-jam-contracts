// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../libraries/JamInteraction.sol";
import "../libraries/JamOrder.sol";

interface IJamSettlement {
    /// @dev Settle a jam order.
    /// Pulls sell tokens into the contract and ensures that after running interactions the minimum of buy
    /// tokens can be sent to the receiver.
    /// @param order user signed order
    /// @param interactions list of interactions to settle the order
    function settle(JamOrder.Data calldata order, JamInteraction.Data[] calldata interactions) external;
}