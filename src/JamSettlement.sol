// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "./JamBalanceManager.sol";
import "./base/JamValidation.sol";
import "./base/JamTransfer.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IJamSettlement.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title JamSettlement
/// @notice The settlement contract executes the full lifecycle of a trade on chain.
/// Solvers figure out what "interactions" to pass to this contract such that the user order is fulfilled.
/// The contract ensures that only the user agreed price can be executed and otherwise will fail to execute.
/// As long as the trade is fulfilled, the solver is allowed to keep any potential excess.
contract JamSettlement is IJamSettlement, ReentrancyGuard, JamValidation, JamTransfer {

    IJamBalanceManager public immutable balanceManager;
    address public immutable bebopBlend;
    using BlendAggregateOrderLib for BlendAggregateOrder;

    constructor(address _permit2, address _bebopBlend) {
        balanceManager = new JamBalanceManager(address(this), _permit2);
        bebopBlend = _bebopBlend;
    }

    receive() external payable {}

    function settle(
        JamOrder.Data calldata order,
        bytes calldata signature,
        JamInteraction.Data[] calldata interactions,
        ExecInfo.SolverData calldata solverData,
        bool usingPermit2
    ) external payable nonReentrant {
        validateOrder(order, signature, JamHooks.EMPTY_HOOKS_HASH, solverData.curFillPercent, usingPermit2);
        if (usingPermit2) {
            balanceManager.transferTokensWithPermit2(
                order, signature, JamHooks.EMPTY_HOOKS_HASH, solverData.balanceRecipient, solverData.curFillPercent
            );
        } else {
            balanceManager.transferTokens(
                order.sellTokens, order.sellAmounts, order.taker, solverData.balanceRecipient, solverData.curFillPercent
            );
        }
        require(JamInteraction.runInteractions(interactions, balanceManager), InteractionsFailed());
        transferTokensFromContract(
            order.buyTokens, order.buyAmounts, order.receiver, solverData.curFillPercent, false
        );
        emit Settlement(order.nonce);
    }

    function settleInternal(
        JamOrder.Data calldata order,
        bytes calldata signature,
        ExecInfo.MakerData calldata makerData,
        bool usingPermit2
    ) external payable nonReentrant {
        validateOrder(order, signature, JamHooks.EMPTY_HOOKS_HASH, makerData.curFillPercent, usingPermit2);
        if (usingPermit2) {
            balanceManager.transferTokensWithPermit2(
                order, signature, JamHooks.EMPTY_HOOKS_HASH, msg.sender, makerData.curFillPercent
            );
        } else {
            balanceManager.transferTokens(
                order.sellTokens, order.sellAmounts, order.taker, msg.sender, makerData.curFillPercent
            );
        }
        uint256[] calldata buyAmounts = validateIncreasedAmounts(makerData.increasedBuyAmounts, order.buyAmounts);
        balanceManager.transferTokens(
            order.buyTokens, buyAmounts, msg.sender, order.receiver, makerData.curFillPercent
        );
        emit Settlement(order.nonce);
    }


    /// @inheritdoc IJamSettlement
    function settleBatch(
        JamOrder.Data[] calldata orders,
        bytes[] calldata signatures,
        JamInteraction.Data[] calldata interactions,
        JamHooks.Def[] calldata hooks,
        ExecInfo.BatchSolverData calldata solverData
    ) external payable nonReentrant {
        validateBatchOrders(orders, hooks, signatures, solverData.takersPermit2, solverData.curFillPercents);
        bool isMaxFill = solverData.curFillPercents.length == 0;
        bool executeHooks = hooks.length != 0;
        bool allTakersWithoutPermit2 = solverData.takersPermit2.length == 0;
        for (uint i; i < orders.length; ++i) {
            if (executeHooks){
                require(JamInteraction.runInteractions(hooks[i].beforeSettle, balanceManager), BeforeSettleHooksFailed());
            }
            if (!allTakersWithoutPermit2 && solverData.takersPermit2[i]) {
                balanceManager.transferTokensWithPermit2(
                    orders[i], signatures[i], executeHooks ? JamHooks.hash(hooks[i]) : JamHooks.EMPTY_HOOKS_HASH,
                    solverData.balanceRecipient, isMaxFill ? BMath.HUNDRED_PERCENT : solverData.curFillPercents[i]
                );
            } else {
                balanceManager.transferTokens(
                    orders[i].sellTokens, orders[i].sellAmounts, orders[i].taker, solverData.balanceRecipient,
                    isMaxFill ? BMath.HUNDRED_PERCENT : solverData.curFillPercents[i]
                );
            }
        }
        require(JamInteraction.runInteractions(interactions, balanceManager), InteractionsFailed());
        for (uint i; i < orders.length; ++i) {
            uint256[] memory curBuyAmounts = solverData.transferExactAmounts ?
                orders[i].buyAmounts : calculateNewAmounts(i, orders, solverData.curFillPercents);
            transferTokensFromContract(
                orders[i].buyTokens, curBuyAmounts,
                orders[i].receiver, isMaxFill ? BMath.HUNDRED_PERCENT : solverData.curFillPercents[i], true
            );
            if (executeHooks){
                require(JamInteraction.runInteractions(hooks[i].afterSettle, balanceManager), AfterSettleHooksFailed());
            }
            emit Settlement(orders[i].nonce);
        }
    }


    function settleBebopBlend(
        bytes memory data,
        address takerAddress,
        IBebopBlend.BlendOrderType orderType
    ) external payable nonReentrant {
        if (orderType == IBebopBlend.BlendOrderType.Single){
            (
                BlendSingleOrder memory order,
                IBebopBlend.MakerSignature memory makerSignature,
                IBebopBlend.OldSingleQuote memory takerQuoteInfo,
                bytes memory takerSignature
            ) = abi.decode(data, (BlendSingleOrder, IBebopBlend.MakerSignature, IBebopBlend.OldSingleQuote, bytes));
            balanceManager.transferTokenForBlendSingleOrder(order, takerQuoteInfo, takerSignature, takerAddress);
            approveToken(IERC20(order.taker_token), order.taker_amount, bebopBlend);
            IBebopBlend(bebopBlend).settleSingle(order, makerSignature, 0, takerQuoteInfo, "0x");
            emit BlendSettlement(uint128(order.flags >> 128));
        } else if (orderType == IBebopBlend.BlendOrderType.Multi){
            (
                BlendMultiOrder memory order,
                IBebopBlend.MakerSignature memory makerSignature,
                IBebopBlend.OldMultiQuote memory takerQuoteInfo,
                bytes memory takerSignature
            ) = abi.decode(data, (BlendMultiOrder, IBebopBlend.MakerSignature, IBebopBlend.OldMultiQuote, bytes));
            balanceManager.transferTokensForMultiBebopOrder(order, takerQuoteInfo, takerSignature, takerAddress);
            for (uint i; i < order.taker_tokens.length; ++i) {
                approveToken(IERC20(order.taker_tokens[i]), order.taker_amounts[i], bebopBlend);
            }
            IBebopBlend(bebopBlend).settleMulti(order, makerSignature, 0, takerQuoteInfo, "0x");
            emit BlendSettlement(uint128(order.flags >> 128));
        } else if (orderType == IBebopBlend.BlendOrderType.Aggregate){
            (
                BlendAggregateOrder memory order,
                IBebopBlend.MakerSignature[] memory makerSignatures,
                IBebopBlend.OldAggregateQuote memory takerQuoteInfo,
                bytes memory takerSignature
            ) = abi.decode(data, (BlendAggregateOrder, IBebopBlend.MakerSignature[], IBebopBlend.OldAggregateQuote, bytes));
            balanceManager.transferTokensForAggregateBebopOrder(order, takerQuoteInfo, takerSignature, takerAddress);
            (address[] memory tokens, uint256[] memory amounts) = order.unpackTokensAndAmounts();
            for (uint i; i < tokens.length; ++i) {
                approveToken(IERC20(tokens[i]), amounts[i], bebopBlend);
            }
            IBebopBlend(bebopBlend).settleAggregate(order, makerSignatures, 0, takerQuoteInfo, "0x");
            emit BlendSettlement(uint128(order.flags >> 128));
        } else {
            revert InvalidBlendOrderType();
        }
    }

}