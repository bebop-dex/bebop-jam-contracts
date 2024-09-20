// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../libraries/ExecInfo.sol";
import "../libraries/JamOrder.sol";
import "../libraries/BlendSingleOrder.sol";
import "../libraries/BlendMultiOrder.sol";
import "../libraries/BlendAggregateOrder.sol";
import "./IBebopBlend.sol";

/// @title IJamBalanceManager
/// @notice User approvals are made here. This handles the complexity of multiple allowance types. 
interface IJamBalanceManager {

    function transferTokenForBlendSingleOrder(
        BlendSingleOrder memory order,
        IBebopBlend.OldSingleQuote memory oldSingleQuote,
        bytes memory takerSignature,
        address takerAddress
    ) external;

    function transferTokensForMultiBebopOrder(
        BlendMultiOrder memory order,
        IBebopBlend.OldMultiQuote memory oldMultiQuote,
        bytes memory takerSignature,
        address takerAddress
    ) external;

    function transferTokensForAggregateBebopOrder(
        BlendAggregateOrder memory order,
        IBebopBlend.OldAggregateQuote memory oldAggregateQuote,
        bytes memory takerSignature,
        address takerAddress
    ) external;


    function transferTokensWithPermit2(
        JamOrder.Data calldata order,
        bytes calldata signature,
        bytes32 hooksHash,
        address receiver,
        uint16 fillPercent
    ) external;

    function transferTokens(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address sender,
        address receiver,
        uint16 fillPercent
    ) external;

}