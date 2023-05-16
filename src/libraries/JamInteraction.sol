// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

library JamInteraction {
    /// @dev Data representing an interaction on the chain
    struct Data {
        /// 
        address to;
        uint256 value;
        bytes data;
    }

    /// @dev Execute the interaciton and return the result
    /// 
    /// @param interaction The interaction to execute
    /// @return result Whether the interaction succeeded
    function execute(Data calldata interaction) internal returns (bool result) {

    }
}