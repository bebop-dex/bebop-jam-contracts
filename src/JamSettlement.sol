// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IJamAllowanceManager.sol";
import "./interfaces/IJamSolverRegistry.sol";
import "./interfaces/IJamSettlement.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";

contract JamSettlement is IJamSettlement {
    IJamAllowanceManager public allowanceManager;
    IJamSolverRegistry public solverRegistry;

    using SafeERC20 for IERC20;

    constructor(IJamAllowanceManager _allowanceManager, IJamSolverRegistry _solverRegistry) {
        allowanceManager = _allowanceManager;
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
         * call allowanceManager.transfer() for order sell tokens
         * run each interaction
         * send order.buyTokens to order.receiver
         */

        // Recover sig
        allowanceManager.transfer(order.from, address(this), order.sellToken, order.sellAmount);
        for (uint i; i < interactions.length; i++) {
            // Prevent calls to allowance manager
            require(interactions[i].to != address(allowanceManager));
            require(JamInteraction.execute(interactions[i]));
        }
        order.buyToken.safeTransfer(order.receiver, order.buyAmount);
    }
}