// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./JamBalanceManager.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IJamSolverRegistry.sol";
import "./interfaces/IJamSettlement.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";

/// @title JamSettlement
/// @notice The settlement contract executes the full lifecycle of a trade on chain. It can only be executed by whitelisted addresses (solvers)
/// Solvers figure out what "interactions" to pass to this contract such that the user order is fulfilled.
/// The contract ensures that only the user agreed price can be executed and otherwise will fail to execute.
/// As long as the trade is fulfilled, the solver is allowed to keep any potential excess.
contract JamSettlement is IJamSettlement {
    IJamBalanceManager public balanceManager;
    IJamSolverRegistry public solverRegistry;

    using SafeERC20 for IERC20;

    constructor(IJamSolverRegistry _solverRegistry) {
        balanceManager = new JamBalanceManager(address(this));
        solverRegistry = _solverRegistry;
    }

    modifier onlySolver(address solver) {
        require(solverRegistry.isAllowed(solver), "INVALID_SOLVER_ADDRESS");
        _;
    }

    /// @inheritdoc IJamSettlement
    function settle(JamOrder.Data calldata order, JamInteraction.Data[] calldata interactions) external onlySolver(msg.sender) {
        /**
         * recover signature from order.signature based on type
         * call balanceManager.transfer() for order sell tokens
         * run each interaction
         * send order.buyTokens to order.receiver
         */

        // Recover sig
        balanceManager.transfer(order.from, address(this), order.sellToken, order.sellAmount);
        for (uint i; i < interactions.length; i++) {
            // Prevent calls to balance manager
            require(interactions[i].to != address(balanceManager));
            require(JamInteraction.execute(interactions[i]));
        }
        order.buyToken.safeTransfer(order.receiver, order.buyAmount);
    }
}