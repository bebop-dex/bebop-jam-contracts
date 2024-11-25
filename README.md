# Bebop Jam

![Alt text](bebop.gif?raw=true "Title")

![Github Actions](https://github.com/bebop-dex/bebop-jam-contracts/workflows/test/badge.svg)



### Setup

*  Install:
```bash
npm install
forge build
```

*  Tests(hardhat)
```bash
npm run test:jam
npm run test:blend
```

*  Tests(foundry)
```bash
forge test
```

### Description

JAM (Just-in-Time Aggregation Model) is Bebop's DeFi liquidity aggregator system allowing any token to any token swaps with highly efficient execution quality.

JAM Solvers are independently run services that provide quotes to Bebop users on an RFQ (Request for Quote) basis. They are responsible for providing accurate prices and reliably executing swaps for the given quotes.



### Trade flow
From  a  systems  perspective,  how  the  trade  is conducted can be defined as follows:

1.Bebop  JAM  orchestrator  receives  an  order request in the form: Buy  1000  Token  A  -  Sell  Token  B  - Slippage: 0.1. The requests support orders for    multiple    tokens    being    exchanged simultaneously.

2.It queries solvers for a solution to the trade; the best solution is returned to the user.

3.The user signs and therefore confirms their trade, producing a signature over the winning solver’s solution.

4.This signature is returned to the orchestrator.

5.The orchestrator passes the user’s signature to the winning solver for them to execute on-chain.

6.The  solver  returns  the  transaction  to  the orchestrator and eventually the user.

### JamOrder
The smart contract is used for both regular trades and limit orders. The only difference between a limit order and a regular one is that order.expiry will be infinite in limit orders. \
A trade can be absolutely any combination of NATIVE/ERC20 in any quantity, for example: \
USDT <-> WETH \
USDT + USDC <-> WETH \
USDT <->  USDC + WETH + WBTC \
...
```solidity
struct JamOrder {
    address taker; // user
    address receiver;
    uint256 expiry;
    uint256 exclusivityDeadline; // if block.timestamp > exclusivityDeadline, then order can be executed by any executor
    uint256 nonce;
    address executor; // only msg.sender=executor is allowed to execute (if executor=address(0), then order can be executed by anyone)
    uint256 partnerInfo; // partnerInfo is a packed struct of feePercent and feeRecipient
    address[] sellTokens;
    address[] buyTokens;
    uint256[] sellAmounts;
    uint256[] buyAmounts;
    bool usingPermit2; // this field is excluded from ORDER_TYPE, so taker doesnt need to sign it
}
```


### Settlement
Solvers/Makers have three options how to execute trade:
1) `settle`
```solidity
 function settle(
    JamOrder calldata order,
    bytes calldata signature,
    JamInteraction.Data[] calldata interactions,
    bytes memory hooksData,
    address balanceRecipient
)
```
`JamOrder order` - all information about the order signed by the taker (passed to the solver via API) \
`bytes calldata signature` - taker signature, can be order signature or permit2+order signature (passed to the solver via API) \
`JamInteraction.Data[] interactions` - solver's interactions to provide the requested assets in the order(like swap on Uniswap etc) \
`bytes memory hooksData` - pre and post interactions specified by taker (for example swap + bridge) (passed to the solver via API) \
`balanceRecipient` - solver's information about where to send initial taker's tokens

2) `settleInternal`
```solidity
function settleInternal(
    JamOrder calldata order,
    bytes calldata signature,
    uint256[] calldata filledAmounts,
    bytes memory hooksData
)
```
This approach is cheaper in gas and may be suitable for makers who provide liquidity directly. 

3) `settleBatch` - solver can submit batch of orders if it wins them around the same time
```solidity
function settleBatch(
    JamOrder[] calldata orders,
    bytes[] calldata signatures,
    JamInteraction.Data[] calldata interactions,
    JamHooks.Def[] calldata hooks,
    address balanceRecipient
) 
```

### BlendOrders

Also this contract can be used as an entry point for the immutable BebopBlend contract that is deployed and verified on 0xbbbbbBB520d69a9775E85b458C58c648259FAD5F address. \
This is done to add Permit2+Witness functionality to BebopBlend contract. \
Users will sign Permit2 + witness of BlendSingleOrder, BlendMultiOrder or BlendAggregateOrder(these structs are copypasted from BebopBlend contract) \
But the only difference from real settlement on BebopBlend contract is that BlendOrder.taker will be current contract address, instead of user address.

```solidity
function settleBebopBlend(
    address takerAddress, // real user address
    IBebopBlend.BlendOrderType orderType, // order type: single=0, multi=1 or aggregate=2
    bytes memory data, // encoded calldata for settle function of BebopBlend
    bytes memory hooksData
)
```