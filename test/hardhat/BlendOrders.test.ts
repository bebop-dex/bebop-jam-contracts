import {getFixture} from './utils/fixture'
import {
  JamHooks,
} from "../../typechain-types/artifacts/src/JamSettlement";
import { PERMIT2_ADDRESS} from "./config";
import {
  approveTokens,
  getBalancesBefore,
  verifyBalancesAfter
} from "./utils/utils";
import {
  encodeAggregateBlendOrderArgsForJam,
  encodeMultiBlendOrderArgsForJam,
  encodeSingleBlendOrderArgsForJam,
} from "./blend/blendCalls";
import {HooksGenerator} from "./hooks/hooksGenerator";

import {BebopSettlement, IBebopBlend} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  BlendAggregateOrderStruct,
  BlendMultiOrderStruct,
  BlendSingleOrderStruct
} from "../../typechain-types/artifacts/src/interfaces/IBebopBlend";
import {
  makerSignBlendOrder, signBlendAggregateOrderAndPermit2,
  signBlendMultiOrderAndPermit2,
  signBlendSingleOrderAndPermit2
} from "./signing/signBebopBlend";
import {getAggregateBlendOrder, getMultiBlendOrder, getSingleBlendOrder} from "./blend/blendOrders";
import {
  BlendCommand,
  getMakerOrderFromAggregate,
  getMakerUniqueTokens,
  getUniqueTokensForAggregate
} from "./blend/blendUtils";


describe("BlendOrders", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let hooksGenerator: HooksGenerator;

  const emptyHooks: JamHooks.DefStruct = {
    beforeSettle: [],
    afterSettle: []
  }
  const emptyHooksHash = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const zeroAddress = "0x0000000000000000000000000000000000000000"


  async function settleBebopBlendSingle(order: BlendSingleOrderStruct) {
    const { user, settlement, directMaker, balanceManager } = fixture;
    await approveTokens([order.taker_token], [order.taker_amount], user, PERMIT2_ADDRESS);
    await approveTokens([order.maker_token], [order.maker_amount],  directMaker, bebop.address)

    let makerSignature: IBebopBlend.MakerSignatureStruct = {
        signatureBytes: await makerSignBlendOrder(directMaker, order, bebop.address),
        flags: 0
    }
    let oldQuoteSingle: IBebopBlend.OldSingleQuoteStruct = {
      useOldAmount: false,
      makerAmount: order.maker_amount,
      makerNonce: order.maker_nonce
    }
    let signature = await signBlendSingleOrderAndPermit2(balanceManager.address, user, order, 0, oldQuoteSingle)
    let orderBytes = encodeSingleBlendOrderArgsForJam(order, makerSignature, oldQuoteSingle, signature)

    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        [order.maker_token], order.receiver, order.maker_address
    )
    await settlement.connect(fixture.executor).settleBebopBlend(orderBytes, user.address, 0);
    await verifyBalancesAfter([order.maker_token], order.receiver, zeroAddress, false,
        [order.maker_amount], 0, userBalancesBefore, {}, true, settlement.address)
  }

  async function settleBebopBlendMulti(order: BlendMultiOrderStruct) {
    const { user, settlement, solver, solverContract, directMaker, balanceManager } = fixture;
    await approveTokens(order.taker_tokens, order.taker_amounts,  user, PERMIT2_ADDRESS);
    await approveTokens(order.maker_tokens, order.maker_amounts, directMaker, bebop.address)

    let makerSignature: IBebopBlend.MakerSignatureStruct = {
      signatureBytes: await makerSignBlendOrder(directMaker, order, bebop.address),
      flags: 0
    }
    let oldQuoteSingle: IBebopBlend.OldMultiQuoteStruct = {
      useOldAmount: false,
      makerAmounts: order.maker_amounts,
      makerNonce: order.maker_nonce
    }
    let signature = await signBlendMultiOrderAndPermit2(balanceManager.address, user, order, 0, oldQuoteSingle)
    let orderBytes = encodeMultiBlendOrderArgsForJam(order, makerSignature, oldQuoteSingle, signature)
    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        order.maker_tokens, order.receiver, order.maker_address
    )
    await settlement.connect(fixture.executor).settleBebopBlend(orderBytes, user.address, 1);
    await verifyBalancesAfter( order.maker_tokens, order.receiver, zeroAddress, false,
        order.maker_amounts, 0, userBalancesBefore, {}, true, settlement.address)
  }

  async function settleBebopBlendAggregate(
      order: BlendAggregateOrderStruct, makers: SignerWithAddress[], takerTransfersTypes: BlendCommand[][], makerTransfersTypes: BlendCommand[][], partnerId: number = 0
  ) {
    const { user, settlement, solver, solverContract, directMaker, balanceManager } = fixture;

    let [tokens, tokenAmounts] = getUniqueTokensForAggregate(order, takerTransfersTypes)
    await approveTokens(tokens, tokens.map(t => tokenAmounts.get(t)!),  user, PERMIT2_ADDRESS);

    let makerSignatures: IBebopBlend.MakerSignatureStruct[] = []
    for (let i= 0; i< order.maker_addresses.length; i++) {
      await approveTokens(order.maker_tokens[i], order.maker_amounts[i], makers[i], bebop.address)
      makerSignatures.push({
        signatureBytes: await makerSignBlendOrder(
            makers[i], getMakerOrderFromAggregate(order, i, takerTransfersTypes, makerTransfersTypes), bebop.address, partnerId
        ),
        flags: 0
      })
    }

    let oldQuoteAggregate: IBebopBlend.OldAggregateQuoteStruct = {
      useOldAmount: false,
      makerAmounts: order.maker_amounts,
      makerNonces: order.maker_nonces
    }
    let signature = await signBlendAggregateOrderAndPermit2(balanceManager.address, user, order, takerTransfersTypes, partnerId, oldQuoteAggregate)
    let orderBytes = encodeAggregateBlendOrderArgsForJam(order, makerSignatures, oldQuoteAggregate, signature)
    let buyTokens = getMakerUniqueTokens(order, makerTransfersTypes)
    let buyTokensSymbols = Array.from(buyTokens.keys())
    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        buyTokensSymbols, order.receiver, makers[0].address
    )
    await settlement.connect(fixture.executor).settleBebopBlend(orderBytes, user.address, 2);
    await verifyBalancesAfter(buyTokensSymbols, order.receiver, zeroAddress, false,
        buyTokensSymbols.map(t => buyTokens.get(t)!), 0, userBalancesBefore, {}, true, settlement.address)
  }

  before(async () => {
    fixture = await getFixture();
    bebop = fixture.bebopBlend
    hooksGenerator = new HooksGenerator(fixture.user)
  });

  it('BebopBlend: SingleOrder', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "Simple", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendSingle(order)
  });

  it('BebopBlend: MultiOrder - One-to-Many', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "One-to-Many", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendMulti(order)
  });

  it('BebopBlend: MultiOrder - Many-to-One', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "Many-to-One", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendMulti(order)
  });

  it('BebopBlend: AggregateOrder - One-to-One', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order, [fixture.bebopMaker, fixture.bebopMaker2], takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-One with partner', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let partnerId = 1
    await fixture.bebopBlend.connect(fixture.user).registerPartner(partnerId, 100, fixture.user.address)
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address, partnerId
    )
    await settleBebopBlendAggregate(order, [fixture.bebopMaker, fixture.bebopMaker2], takerTransfersTypes, makerTransfersTypes, partnerId)
  });

  it('BebopBlend: AggregateOrder - One-to-Many', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order, [fixture.bebopMaker, fixture.bebopMaker2], takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - Many-to-One', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "Many-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order, [fixture.bebopMaker, fixture.bebopMaker2], takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-One with extra hop', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One with extra hop", fixture.settlement.address, makers.map(m => m.address), fixture.user.address,
    )
    await settleBebopBlendAggregate(order, [fixture.bebopMaker, fixture.bebopMaker2], takerTransfersTypes, makerTransfersTypes)
  });


});
