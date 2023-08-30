// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../libraries/JamInteraction.sol";
import "../libraries/JamOrder.sol";
import "../libraries/JamHooks.sol";
import "../libraries/Signature.sol";

interface IJamSettlement {

    /// @dev Event emitted when a settlement is executed successfully
    event Settlement(uint256 indexed quoteId);

    /// @dev Settle a jam order.
    /// Pulls sell tokens into the contract and ensures that after running interactions receiver has the minimum of buy
    /// @param order user signed order
    /// @param signature user signature
    /// @param interactions list of interactions to settle the order
    /// @param hooks pre and post interactions
    /// @param balanceRecipient receiver of the balance
    function settle(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        JamInteraction.Data[] calldata interactions,
        JamHooks.Def calldata hooks,
        address balanceRecipient
    ) external payable;

    /// @dev Settle a jam order using taker's Permit/Permit2.
    /// Pulls sell tokens into the contract and ensures that after running interactions receiver has the minimum of buy
    /// @param order user signed order
    /// @param signature user signature
    /// @param interactions list of interactions to settle the order
    /// @param hooks pre and post interactions
    /// @param balanceRecipient receiver of the balance
    function settleWithTakerPermits(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        Signature.TakerPermitsInfo calldata takerPermitsInfo,
        JamInteraction.Data[] calldata interactions,
        JamHooks.Def calldata hooks,
        address balanceRecipient
    ) external payable;

    /// @dev Settle a jam order.
    /// Pulls sell tokens into the contract and ensures that after running interactions receiver has the minimum of buy
    /// @param order user signed order
    /// @param signature user signature
    /// @param hooks pre and post interactions
    /// @param increasedBuyAmounts if maker wants to increase user's order.buyAmounts,
    /// then maker can specify new buyAmounts here, otherwise it should be empty array
    function settleInternal(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        JamHooks.Def calldata hooks,
        uint256[] calldata increasedBuyAmounts
    ) external payable;

    /// @dev Settle a jam order using taker's Permit/Permit2.
    /// Pulls sell tokens into the contract and ensures that after running interactions receiver has the minimum of buy
    /// @param order user signed order
    /// @param signature user signature
    /// @param hooks pre and post interactions
    /// @param increasedBuyAmounts if maker wants to increase user's order.buyAmounts,
    /// then maker can specify new buyAmounts here, otherwise it should be empty array
    function settleInternalWithTakerPermits(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        Signature.TakerPermitsInfo calldata takerPermitsInfo,
        JamHooks.Def calldata hooks,
        uint256[] calldata increasedBuyAmounts
    ) external payable;
}