// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../interfaces/IJamBalanceManager.sol";

library JamInteraction {

    /// @dev Data representing an interaction on the chain
    struct Data {
        bool result;
        address to;
        uint256 value;
        bytes data;
    }

    /// @dev Execute the interaciton and return the result
    /// 
    /// @param interaction The interaction to execute
    /// @return result Whether the interaction succeeded
    function execute(Data calldata interaction) internal returns (bool result) {
        (bool _result,) = payable(interaction.to).call{ value: interaction.value }(interaction.data);
        return _result;
    }

    function runInteractions(
        JamInteraction.Data[] calldata interactions, IJamBalanceManager balanceManager
    ) internal returns (bool result) {
        for (uint i; i < interactions.length; ++i) {
            // Prevent calls to balance manager
            require(interactions[i].to != address(balanceManager));
            bool execResult = execute(interactions[i]);

            // Return false only if interaction was meant to succeed but failed.
            if (!execResult && interactions[i].result) return false;
        }
        return true;
    }
}