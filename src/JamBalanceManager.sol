// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "./base/JamTransfer.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IPermit2.sol";
import "./libraries/common/BMath.sol";

/// @title JamBalanceManager
/// @notice The reason a balance manager exists is to prevent interaction to the settlement contract draining user funds
/// By having another contract that allowances are made to, we can enforce that it is only used to draw in user balances to settlement and not sent out
contract JamBalanceManager is IJamBalanceManager {

    using SafeTransferLib for IERC20;
    using BlendSingleOrderLib for BlendSingleOrder;
    using BlendMultiOrderLib for BlendMultiOrder;
    using BlendAggregateOrderLib for BlendAggregateOrder;

    address private immutable operator;
    IPermit2 private immutable PERMIT2;
    uint256 private immutable _chainId;

    constructor(address _operator, address _permit2) {
        // Operator can be defined at creation time with `msg.sender`
        // Pass in the settlement - and that can be the only caller.
        operator = _operator;
        _chainId = block.chainid;
        PERMIT2 = IPermit2(_permit2);
    }

    modifier onlyOperator(address account) {
        require(account == operator, InvalidCaller());
        _;
    }

    function transferTokenForBlendSingleOrder(
        BlendSingleOrder memory order,
        IBebopBlend.OldSingleQuote memory oldSingleQuote,
        bytes memory takerSignature,
        address takerAddress
    ) onlyOperator(msg.sender) external {
        PERMIT2.permitWitnessTransferFrom(
            IPermit2.PermitTransferFrom(
                IPermit2.TokenPermissions(order.taker_token, order.taker_amount), order.flags >> 128, order.expiry
            ),
            IPermit2.SignatureTransferDetails(operator, order.taker_amount),
            takerAddress,
            order.hash(oldSingleQuote.makerAmount, oldSingleQuote.makerNonce),
            BlendSingleOrderLib.PERMIT2_ORDER_TYPE,
            takerSignature
        );
    }

    function transferTokensForMultiBebopOrder(
        BlendMultiOrder memory order,
        IBebopBlend.OldMultiQuote memory oldMultiQuote,
        bytes memory takerSignature,
        address takerAddress
    ) onlyOperator(msg.sender) external {
        PERMIT2.permitWitnessTransferFrom(
            order.toBatchPermit2(),
            order.toSignatureTransferDetails(operator),
            takerAddress,
            order.hash(oldMultiQuote.makerAmounts, oldMultiQuote.makerNonce),
            BlendMultiOrderLib.PERMIT2_ORDER_TYPE,
            takerSignature
        );
    }

    function transferTokensForAggregateBebopOrder(
        BlendAggregateOrder memory order,
        IBebopBlend.OldAggregateQuote memory oldAggregateQuote,
        bytes memory takerSignature,
        address takerAddress
    ) onlyOperator(msg.sender) external {
        (address[] memory tokens, uint256[] memory amounts) = order.unpackTokensAndAmounts();
        PERMIT2.permitWitnessTransferFrom(
            order.toBatchPermit2(tokens, amounts),
            BlendAggregateOrderLib.toSignatureTransferDetails(amounts, operator),
            takerAddress,
            order.hash(oldAggregateQuote.makerAmounts, oldAggregateQuote.makerNonces),
            BlendAggregateOrderLib.PERMIT2_ORDER_TYPE,
            takerSignature
        );
    }

    function transferTokensWithPermit2(
        JamOrder.Data calldata order,
        bytes calldata signature,
        bytes32 hooksHash,
        address receiver,
        uint16 fillPercent
    ) onlyOperator(msg.sender) external {
        PERMIT2.permitWitnessTransferFrom(
            JamOrder.toBatchPermit2(order),
            JamOrder.toSignatureTransferDetails(order, receiver, fillPercent),
            order.taker,
            JamOrder.hash(order, hooksHash),
            JamOrder.PERMIT2_ORDER_TYPE,
            signature
        );
    }

    function transferTokens(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address sender,
        address receiver,
        uint16 fillPercent
    ) onlyOperator(msg.sender) external {
        for (uint i; i < tokens.length; ++i){
            if (tokens[i] != JamOrder.NATIVE_TOKEN){
                require(fillPercent == BMath.HUNDRED_PERCENT, InvalidFillPercentForNative());
                IERC20(tokens[i]).safeTransferFrom(
                    sender, receiver, BMath.getPercentage(amounts[i], fillPercent)
                );
            } else if (receiver != operator){
                JamTransfer(operator).transferNativeFromContract(
                    receiver, BMath.getPercentage(amounts[i], fillPercent)
                );
            }
        }
    }


}