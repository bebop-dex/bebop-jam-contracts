// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../libraries/JamInteraction.sol";

/// @title 
/// @author 
/// @notice 
library JamHooks {

    /// @dev TODO: Possibly use uniswap like hook contracts instead
    struct Def {
        JamInteraction.Data[] beforeSettle;
        JamInteraction.Data[] afterSettle;
        // TODO: after funds in
        // TODO: before funds leave
    }
}
