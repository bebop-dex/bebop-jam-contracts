// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

library ExecInfo {

    /// @dev Data structure that solvers specify by themselves in settle() function
    struct SolverData {
        address balanceRecipient; // receiver of the initial tokens transfer from taker (usually it is solver contract)
        uint16 curFillPercent; // percentage by which the solver fills the order (curFillPercent >= order.minFillPercent)
    }

    /// @dev Data structure that solvers specify by themselves in settleBatch() function
    struct BatchSolverData {
        address balanceRecipient; // receiver of the initial tokens transfer from taker (usually it is solver contract)
        uint16[] curFillPercents; // if empty array, then all orders will be 100% filled
        bool[] takersPermit2; // indicates whether taker using permit2 signature or not
                                  // (if empty array, then all orders without permit2 siagntures)
        bool transferExactAmounts; // True - if solver is planning to transfer exact amounts which are specified in order.buyAmounts
                                   // False - if solver is planning to transfer more tokens than in order.buyAmounts,
    }

    /// @dev Data structure that makers specify by themselves in settleInternal() function
    struct MakerData {
        uint256[] increasedBuyAmounts; // if maker wants to increase user's order.buyAmounts,
                                       // then maker can specify new buyAmounts here, otherwise it should be empty array
        uint16 curFillPercent; // percentage by which the maker fills the order (curFillPercent >= order.minFillPercent)
    }

}
