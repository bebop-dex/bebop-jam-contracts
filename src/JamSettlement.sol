// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./JamBalanceManager.sol";
import "./base/JamSigning.sol";
import "./base/JamTransfer.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IJamSettlement.sol";
import "./interfaces/IWETH.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";
import "./libraries/JamHooks.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title JamSettlement
/// @notice The settlement contract executes the full lifecycle of a trade on chain.
/// Solvers figure out what "interactions" to pass to this contract such that the user order is fulfilled.
/// The contract ensures that only the user agreed price can be executed and otherwise will fail to execute.
/// As long as the trade is fulfilled, the solver is allowed to keep any potential excess.
contract JamSettlement is IJamSettlement, ReentrancyGuard, JamSigning, JamTransfer, ERC721Holder, ERC1155Holder {

    IJamBalanceManager public immutable balanceManager;

    constructor(address _permit2) {
        balanceManager = new JamBalanceManager(address(this), _permit2);
    }

    receive() external payable {}

    function runInteractions(JamInteraction.Data[] calldata interactions) internal returns (bool result) {
        for (uint i; i < interactions.length; ++i) {
            // Prevent calls to balance manager
            require(interactions[i].to != address(balanceManager));
            bool execResult = JamInteraction.execute(interactions[i]);

            // Return false only if interaction was meant to succeed but failed.
            if (!execResult && interactions[i].result) return false;
        }
        return true;
    }

    /// @inheritdoc IJamSettlement
    function settle(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        JamInteraction.Data[] calldata interactions,
        JamHooks.Def calldata hooks,
        address balanceRecipient
    ) external payable nonReentrant {
        validateOrder(order, hooks, signature);
        require(runInteractions(hooks.beforeSettle), "BEFORE_SETTLE_HOOKS_FAILED");
        balanceManager.transferTokens(
            order.taker, balanceRecipient, order.sellTokens, order.sellAmounts, order.sellNFTIds, order.sellTokenTransfers
        );
        if (order.receiver == address(this)){
            uint256[] memory initialReceiverBalances = getInitialBalances(
                order.buyTokens,order.buyNFTIds, order.buyTokenTransfers, order.receiver
            );
            require(runInteractions(interactions), "INTERACTIONS_FAILED");
            verifyBalances(
                order.buyTokens, order.buyAmounts, initialReceiverBalances, order.buyNFTIds, order.buyTokenTransfers, order.receiver
            );
            require(hooks.afterSettle.length > 0, "AFTER_SETTLE_HOOKS_REQUIRED");
        } else {
            require(runInteractions(interactions), "INTERACTIONS_FAILED");
            transferTokensFromContract(
                order.buyTokens, order.buyAmounts, order.buyNFTIds, order.buyTokenTransfers, order.receiver
            );
        }
        require(runInteractions(hooks.afterSettle), "AFTER_SETTLE_HOOKS_FAILED");
        emit Settlement(order.nonce);
    }

    /// @inheritdoc IJamSettlement
    function settleInternal(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        JamHooks.Def calldata hooks
    ) external payable nonReentrant {
        validateOrder(order, hooks, signature);
        require(runInteractions(hooks.beforeSettle), "BEFORE_SETTLE_HOOKS_FAILED");
        balanceManager.transferTokens(
            order.taker, msg.sender, order.sellTokens, order.sellAmounts, order.sellNFTIds, order.sellTokenTransfers
        );
        balanceManager.transferTokens(
            msg.sender, order.receiver, order.buyTokens, order.buyAmounts, order.buyNFTIds, order.buyTokenTransfers
        );
        require(runInteractions(hooks.afterSettle), "AFTER_SETTLE_HOOKS_FAILED");
        emit Settlement(order.nonce);
    }
}