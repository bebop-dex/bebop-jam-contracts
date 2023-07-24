// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./JamBalanceManager.sol";
import "./JamSigning.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IJamSettlement.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";
import "./libraries/JamHooks.sol";
import "./libraries/JamTransfer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title JamSettlement
/// @notice The settlement contract executes the full lifecycle of a trade on chain. It can only be executed by whitelisted addresses (solvers)
/// Solvers figure out what "interactions" to pass to this contract such that the user order is fulfilled.
/// The contract ensures that only the user agreed price can be executed and otherwise will fail to execute.
/// As long as the trade is fulfilled, the solver is allowed to keep any potential excess.
contract JamSettlement is IJamSettlement, ReentrancyGuard, JamSigning {
    IJamBalanceManager public balanceManager;

    using SafeERC20 for IERC20;

    constructor(address _permit2) {
        balanceManager = new JamBalanceManager(address(this), _permit2);
    }

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
        JamTransfer.Initial calldata initTransfer
    ) external payable nonReentrant {
        validateOrder(order, hooks, signature);
        require(runInteractions(hooks.beforeSettle), "BEFORE_SETTLE_HOOKS_FAILED");
        balanceManager.transferTokens(order.taker, initTransfer, order.sellTokens, order.sellAmounts, order.sellTokenTransfers);
        require(runInteractions(interactions), "INTERACTIONS_FAILED");
        for (uint i; i < order.buyTokens.length; ++i) {
            uint tokenBalance = IERC20(order.buyTokens[i]).balanceOf(address(this));
            require(tokenBalance >= order.buyAmounts[i], "INSUFFICIENT_TOKEN_BALANCE");
            // TODO: add ability to buy NFTs
            IERC20(order.buyTokens[i]).safeTransfer(order.receiver, tokenBalance);
        }
        require(runInteractions(hooks.afterSettle), "AFTER_SETTLE_HOOKS_FAILED");
        emit Settlement(msg.sender, order.nonce);
    }
}