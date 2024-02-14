#### Please treat all work within this repository, including all branches, as confidential.

# Bebop Jam

![Alt text](bebop.gif?raw=true "Title")

![Github Actions](https://github.com/bebop-dex/bebop-jam-contracts/workflows/test/badge.svg)


JAM (Just-in-Time Aggregation Model) is Bebop's DeFi liquidity aggregator system allowing any token to any token swaps with highly efficient execution quality.

JAM Solvers are independently run services that provide quotes to Bebop users on an RFQ (Request for Quote) basis. They are responsible for providing accurate prices and reliably executing swaps for the given quotes.

### Trade flow
From  a  systems  perspective,  how  the  trade  is conducted can be defined as follows:

1.Bebop  JAM  orchestrator  receives  an  order request in the form: Buy  1000  Token  A  -  Sell  Token  B  - Slippage: 0. The requests support orders for    multiple    tokens    being    exchanged simultaneously.

2.It queries solvers for a solution to the trade; the best solution is returned to the user.

3.The user signs and therefore confirms their trade, producing a signature over the winning solver’s solution.

4.This signature is returned to the orchestrator.

5.The orchestrator passes the user’s signature to the winning solver for them to execute on-chain.

6.The  solver  returns  the  transaction  to  the orchestrator and eventually the user.

### Order
The smart contract is used for both regular trades and limit orders. The only difference between a limit order and a regular one is that order.expiry will be infinite in limit orders. \
A trade can be absolutely any combination of NATIVE/ERC20/ERC721/ERC1155 in any quantity, for example: \
USDT <-> WETH \
USDT + USDC <-> WETH \
USDT <->  USDC + WETH + WBTC \
WETH <-> NFT \
NFT + USDC <-> ETH + USDT \
...
```solidity
struct Data {
    address taker;
    address receiver;
    uint256 expiry;
    uint256 nonce; // unique nonce based on quote-id
    uint16 minFillPercent; // 100% = 10000, if taker allows partial fills could be less than 100%
    bytes32 hooksHash; // produced by hashHooks() = keccak256(pre interactions + post interactions)
    address[] sellTokens;
    address[] buyTokens;
    uint256[] sellAmounts;
    uint256[] buyAmounts;
    uint256[] sellNFTIds;
    uint256[] buyNFTIds;
    bytes sellTokenTransfers; // Commands sequence of sellToken transfer types
    bytes buyTokenTransfers; // Commands sequence of buyToken transfer types
}
```

Commands are used to specify how tokens are transferred in buyTokenTransfers and sellTokenTransfers
```solidity
library Commands {
    bytes1 internal constant SIMPLE_TRANSFER = 0x00; // simple transfer with standard transferFrom
    bytes1 internal constant PERMIT2_TRANSFER = 0x01; // transfer using permit2.transfer
    bytes1 internal constant CALL_PERMIT_THEN_TRANSFER = 0x02; // call permit then simple transfer
    bytes1 internal constant CALL_PERMIT2_THEN_TRANSFER = 0x03; // call permit2.permit then permit2.transfer
    bytes1 internal constant NATIVE_TRANSFER = 0x04; // transfer of ETH for mainnet, MATIC for polygon , etc
    bytes1 internal constant NFT_ERC721_TRANSFER = 0x05;
    bytes1 internal constant NFT_ERC1155_TRANSFER = 0x06;
}
```

### Settlement
Solvers/Makers have three options how to execute trade:
1) `settle` (or `settleWithPermitsSignatures` if quote has approval_type=permits)
```solidity
function settle(
    JamOrder.Data calldata order,
    Signature.TypedSignature calldata signature,
    JamInteraction.Data[] calldata interactions,
    JamHooks.Def calldata hooks,
    ExecInfo.SolverData calldata solverData
)
```
`JamOrder.Data order` - all information about the order signed by the taker (passed to the solver via API) \
`Signature.TypedSignature signature` - taker signature and signature type (passed to the solver via API) \
`JamInteraction.Data[] interactions` - solver's interactions to provide the requested assets in the order \
`JamHooks.Def hooks` - pre and post interactions specified by taker (for example swap + bridge) (passed to the solver via API) \
`ExecInfo.SolverData solverData` - solver's extra information about execution

2) `settleInternal` (or `settleInternalWithPermitsSignatures` if quote has approval_type=permits)
```solidity
function settleInternal(
    JamOrder.Data calldata order,
    Signature.TypedSignature calldata signature,
    JamHooks.Def calldata hooks,
    ExecInfo.MakerData calldata makerData
)
```
This approach is cheaper in gas and may be suitable for makers who provide liquidity directly. 

3) `settleBatch` - solver can submit batch of orders if it wins them around the same time
```solidity
function settleBatch(
    JamOrder.Data[] calldata orders,
    Signature.TypedSignature[] calldata signatures,
    Signature.TakerPermitsInfo[] calldata takersPermitsInfo,
    JamInteraction.Data[] calldata interactions,
    JamHooks.Def[] calldata hooks,
    ExecInfo.BatchSolverData calldata solverData
)
```

### Tests

*  Hardhat tests:
```bash
npm install
hardhat compile
hardhat test
```

 *  Foundry tests(WIP): 
```bash
forge test
```

### Slither + Slitherin (extra detectors)

Install original slither and extra detectors:
```shell
pip3 install slither-analyzer
git clone https://github.com/pessimistic-io/slitherin.git
cd slitherin
python3 setup.py develop
```
Run slither:
```shell
slither --config-file slither.config.json --checklist . > slither.md
```

# Deploying to ZKSync

`PRIVATE_KEY='xxx' npx hardhat deploy-zksync --script deploy/deployZkSync.ts --network zkSyncTestnet`

Verifying:

`npx hardhat verify --show-stack-traces --network zkSyncTestnet 0x1acbBaDF7486885B33E2199fFeACD6a232adb01C 0x0000000000225e31D15943971F47aD3022F714Fa 0x0000000000000000000000000000000000000000`
