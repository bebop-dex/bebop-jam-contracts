import {getFixture} from './utils/fixture'
import {
  JamHooks,
} from "../../typechain-types/artifacts/src/JamSettlement";
import {NATIVE_TOKEN, PERMIT2_ADDRESS, TOKENS} from "./config";
import {
  approveTokens, assertBlendAggregateEvent, encodeHooks,
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
  BlendCommand, getEventId,
  getMakerOrderFromAggregate,
  getMakerUniqueTokens,
  getUniqueTokensForAggregate
} from "./blend/blendUtils";
import {BigNumber, utils} from "ethers";
import {expect} from "chai";


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


  async function settleBebopBlendSingle(
      order: BlendSingleOrderStruct, hooks: JamHooks.DefStruct, oldQuoteSingle: IBebopBlend.OldSingleQuoteStruct | null = null
  ) {
    const { user, settlement, directMaker, balanceManager } = fixture;
    await approveTokens([order.taker_token], [order.taker_amount], user, PERMIT2_ADDRESS);
    await approveTokens([order.maker_token], [order.maker_amount],  directMaker, bebop.address)

    let makerSignature: IBebopBlend.MakerSignatureStruct = {
        signatureBytes: await makerSignBlendOrder(directMaker, order, bebop.address),
        flags: 0
    }
    let hooksHash = hooks === emptyHooks ? emptyHooksHash : utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    if (oldQuoteSingle === null){
      oldQuoteSingle = {
        useOldAmount: false,
        makerAmount: order.maker_amount,
        makerNonce: order.maker_nonce
      }
    }
    let signature = await signBlendSingleOrderAndPermit2(balanceManager.address, user, order, hooksHash, 0, oldQuoteSingle)
    let orderBytes = encodeSingleBlendOrderArgsForJam(order, makerSignature, oldQuoteSingle, signature)

    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        [order.maker_token], order.receiver, order.maker_address
    )
    let encodedHooks = encodeHooks(hooks);
    let res = await settlement.connect(fixture.executor).settleBebopBlend(user.address, 0, orderBytes, encodedHooks);
    let amounts = oldQuoteSingle.useOldAmount ? [oldQuoteSingle.makerAmount] : [order.maker_amount]
    await verifyBalancesAfter([order.maker_token], order.receiver, zeroAddress, false,
        amounts, 0, userBalancesBefore, {}, false, settlement.address)
    await expect(res).to.emit(settlement, "BebopBlendSingleOrderFilled").withArgs(
        getEventId(BigNumber.from(order.flags)), order.receiver, order.taker_token, order.maker_token,  order.taker_amount, amounts[0]
    )
  }

  async function settleBebopBlendMulti(
      order: BlendMultiOrderStruct, hooks: JamHooks.DefStruct, oldQuoteMulti: IBebopBlend.OldMultiQuoteStruct | null = null
  ) {
    const { user, settlement, solver, solverContract, directMaker, balanceManager } = fixture;
    await approveTokens(order.taker_tokens, order.taker_amounts,  user, PERMIT2_ADDRESS);
    await approveTokens(order.maker_tokens, order.maker_amounts, directMaker, bebop.address)

    let makerSignature: IBebopBlend.MakerSignatureStruct = {
      signatureBytes: await makerSignBlendOrder(directMaker, order, bebop.address),
      flags: 0
    }
    if (oldQuoteMulti === null){
      oldQuoteMulti = {
        useOldAmount: false,
        makerAmounts: order.maker_amounts,
        makerNonce: order.maker_nonce
      }
    }
    let hooksHash = hooks === emptyHooks ? emptyHooksHash : utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    let signature = await signBlendMultiOrderAndPermit2(balanceManager.address, user, order, hooksHash, 0, oldQuoteMulti)
    let orderBytes = encodeMultiBlendOrderArgsForJam(order, makerSignature, oldQuoteMulti, signature)
    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        order.maker_tokens, order.receiver, order.maker_address
    )
    let res = await settlement.connect(fixture.executor).settleBebopBlend(user.address, 1, orderBytes, "0x");
    let amounts = oldQuoteMulti.useOldAmount ? oldQuoteMulti.makerAmounts : order.maker_amounts
    await verifyBalancesAfter( order.maker_tokens, order.receiver, zeroAddress, false,
        amounts, 0, userBalancesBefore, {}, true, settlement.address)
    await expect(res).to.emit(settlement, "BebopBlendMultiOrderFilled").withArgs(
        getEventId(BigNumber.from(order.flags)), order.receiver, order.taker_tokens, order.maker_tokens,  order.taker_amounts, amounts
    )
  }

  async function settleBebopBlendAggregate(
      order: BlendAggregateOrderStruct,
      hooks: JamHooks.DefStruct,
      makers: SignerWithAddress[],
      takerTransfersTypes: BlendCommand[][],
      makerTransfersTypes: BlendCommand[][],
      oldQuoteAggregate: IBebopBlend.OldAggregateQuoteStruct | null = null,
      partnerId: number = 0,
      allWrappedIsNative: boolean = false
  ) {
    const { user, settlement, solver, solverContract, directMaker, balanceManager } = fixture;

    let [tokens, tokenAmounts] = getUniqueTokensForAggregate(order, takerTransfersTypes)
    await approveTokens(tokens, tokens.map(t => tokenAmounts.get(t)!),  user, PERMIT2_ADDRESS);

    let makerSignatures: IBebopBlend.MakerSignatureStruct[] = []
    for (let i= 0; i < order.maker_addresses.length; i++) {
      await approveTokens(order.maker_tokens[i], order.maker_amounts[i], makers[i], bebop.address)
      makerSignatures.push({
        signatureBytes: await makerSignBlendOrder(
            makers[i], getMakerOrderFromAggregate(order, i, takerTransfersTypes, makerTransfersTypes), bebop.address, partnerId
        ),
        flags: 0
      })
    }

    if (oldQuoteAggregate === null){
      oldQuoteAggregate = {
        useOldAmount: false,
        makerAmounts: order.maker_amounts,
        makerNonces: order.maker_nonces
      }
    }
    let hooksHash = hooks === emptyHooks ? emptyHooksHash : utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    let signature = await signBlendAggregateOrderAndPermit2(balanceManager.address, user, order, hooksHash, takerTransfersTypes, partnerId, oldQuoteAggregate)
    let orderBytes = encodeAggregateBlendOrderArgsForJam(order, makerSignatures, oldQuoteAggregate, signature)
    let buyTokens = getMakerUniqueTokens(
        order, makerTransfersTypes, oldQuoteAggregate.useOldAmount ? oldQuoteAggregate.makerAmounts : order.maker_amounts
    )
    if (allWrappedIsNative && buyTokens.has(TOKENS.WETH)){
      buyTokens.set(NATIVE_TOKEN, buyTokens.get(TOKENS.WETH)!)
      buyTokens.delete(TOKENS.WETH)
    }
    let buyTokensSymbols = Array.from(buyTokens.keys())
    let [userBalancesBefore, makerBalancesBefore] = await getBalancesBefore(
        buyTokensSymbols, order.receiver, makers[0].address
    )
    let res = await settlement.connect(fixture.executor).settleBebopBlend(user.address, 2, orderBytes, "0x");
    await verifyBalancesAfter(buyTokensSymbols, order.receiver, zeroAddress, false,
        buyTokensSymbols.map(t => buyTokens.get(t)!), 0, userBalancesBefore, {}, true, settlement.address)
    let events = (await res.wait(1)).events!
    assertBlendAggregateEvent(
        events[events.length - 1].args,
        getEventId(BigNumber.from(order.flags)), order.receiver, order.taker_tokens, order.maker_tokens,  order.taker_amounts,
        oldQuoteAggregate.useOldAmount ? oldQuoteAggregate.makerAmounts : order.maker_amounts
    )
  }

  before(async () => {
    fixture = await getFixture();
    bebop = fixture.bebopBlend
    hooksGenerator = new HooksGenerator(fixture.user)
  });


  //-----------------------------------------
  //
  //               SingleOrder
  //
  // -----------------------------------------

  it('BebopBlend: SingleOrder', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "Simple", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendSingle(order, emptyHooks)
  });

  it('BebopBlend: SingleOrder with sending better amounts to user', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "Simple", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteSingle = {
        useOldAmount: false,
        makerAmount: BigNumber.from(order.maker_amount).sub(BigNumber.from(1000)),
        makerNonce: Math.floor(Math.random() * 1000000)
    }
    await settleBebopBlendSingle(order, emptyHooks, oldQuoteSingle)
  });

  it('BebopBlend: SingleOrder with keeping positive slippage', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "Simple", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteSingle = {
      useOldAmount: true,
      makerAmount: BigNumber.from(order.maker_amount).sub(BigNumber.from(1000)),
      makerNonce: Math.floor(Math.random() * 1000000)
    }
    await settleBebopBlendSingle(order, emptyHooks, oldQuoteSingle)
  });

  it('BebopBlend: SingleOrder with worse amounts', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "Simple", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteSingle = {
      useOldAmount: true,
      makerAmount: BigNumber.from(order.maker_amount).add(BigNumber.from(1000)),
      makerNonce: Math.floor(Math.random() * 1000000)
    }
    try {
      await settleBebopBlendSingle(order, emptyHooks, oldQuoteSingle)
    } catch (e){
        return
    }
    throw new Error("Should revert with 0x711dbe4a error")
  });

  it('BebopBlend: SingleOrder with beforeSettle hooks', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "SimpleERC20Permit", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    // we will still use Permit2 approvals for transfer, but just as an example of hooks
    const takerPermit = await hooksGenerator.getHook_Permit(order.taker_token, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settleBebopBlendSingle(order, hooks)
  })

  it('BebopBlend: SingleOrder with afterSettle hooks', async function () {
    let order: BlendSingleOrderStruct = getSingleBlendOrder(
        "NativeToJamSettlement", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    // wrap native and send to user, these hooks don't have any meaning, because you can send native token directly
    const hookForWrapping = await hooksGenerator.getHook_wrapNative(order.maker_amount);
    const hookForTransfer = await hooksGenerator.getHook_transferERC20(TOKENS.WETH, order.maker_amount, fixture.user.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: [
        { result: true, to: hookForWrapping.to!, data: hookForWrapping.data!, value: hookForWrapping.value! }, // wrap native token
        { result: true, to: hookForTransfer.to!, data: hookForTransfer.data!, value: hookForTransfer.value || "0" } // send to user
      ]
    }
    await settleBebopBlendSingle(order, hooks)
  })


  //-----------------------------------------
  //
  //               MultiOrder
  //
  // -----------------------------------------

  it('BebopBlend: MultiOrder - One-to-Many', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "One-to-Many", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendMulti(order, emptyHooks)
  });

  it('BebopBlend: MultiOrder - Many-to-One', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "Many-to-One", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    await settleBebopBlendMulti(order, emptyHooks)
  });

  it('BebopBlend: MultiOrder - Many-to-One with sending better amounts to user', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "Many-to-One", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteMulti = {
      useOldAmount: false,
      makerAmounts: order.maker_amounts.map(x => BigNumber.from(x).sub(BigNumber.from(1000))),
      makerNonce: Math.floor(Math.random() * 1000000)
    }
    await settleBebopBlendMulti(order, emptyHooks, oldQuoteMulti)
  });

  it('BebopBlend: MultiOrder - Many-to-One with keeping positive slippage', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "Many-to-One", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteMulti = {
      useOldAmount: true,
      makerAmounts: order.maker_amounts.map(x => BigNumber.from(x).sub(BigNumber.from(1000))),
      makerNonce: Math.floor(Math.random() * 1000000)
    }
    await settleBebopBlendMulti(order, emptyHooks, oldQuoteMulti)
  });

  it('BebopBlend: MultiOrder - Many-to-One with worse amounts', async function () {
    let order: BlendMultiOrderStruct = getMultiBlendOrder(
        "Many-to-One", fixture.settlement.address, fixture.directMaker.address, fixture.user.address
    )
    let oldQuoteMulti = {
      useOldAmount: false,
      makerAmounts: order.maker_amounts.map(x => BigNumber.from(x).add(BigNumber.from(1000))),
      makerNonce: Math.floor(Math.random() * 1000000)
    }
    try {
      await settleBebopBlendMulti(order, emptyHooks, oldQuoteMulti)
    } catch (e){
      return
    }
    throw new Error("Should revert with 0x711dbe4a error")
  });



  //-----------------------------------------
  //
  //               AggregateOrder
  //
  // -----------------------------------------

  it('BebopBlend: AggregateOrder - One-to-One', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order, emptyHooks, makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-One with partner', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let partnerId = 1
    await fixture.bebopBlend.connect(fixture.user).registerPartner(partnerId, 100, fixture.user.address)
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address, partnerId
    )
    await settleBebopBlendAggregate(order, emptyHooks, makers, takerTransfersTypes, makerTransfersTypes, null, partnerId)
  });

  it('BebopBlend: AggregateOrder - One-to-Many', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order,  emptyHooks,makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-Many with native token', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many with native token", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order,  emptyHooks,makers, takerTransfersTypes, makerTransfersTypes, null, 0, true)
  });

  it('BebopBlend: AggregateOrder - Many-to-One', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "Many-to-One", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    await settleBebopBlendAggregate(order,  emptyHooks,makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-One with extra hop', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One with extra hop", fixture.settlement.address, makers.map(m => m.address), fixture.user.address,
    )
    await settleBebopBlendAggregate(order,  emptyHooks,makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-One with 3 makers', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2, fixture.bebopMaker3]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One with 3 makers", fixture.settlement.address, makers.map(m => m.address), fixture.user.address,
    )
    await settleBebopBlendAggregate(order,  emptyHooks,makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - Many-to-One 3 makers with hop', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2, fixture.bebopMaker3]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-One with 3 makers", fixture.settlement.address, makers.map(m => m.address), fixture.user.address,
    )
    await settleBebopBlendAggregate(order,  emptyHooks, makers, takerTransfersTypes, makerTransfersTypes)
  });

  it('BebopBlend: AggregateOrder - One-to-Many with sending better amounts to user', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    let oldQuoteAggregate = {
      useOldAmount: false,
      makerAmounts: order.maker_amounts.map(maker_amounts => maker_amounts.map(x => BigNumber.from(x).sub(BigNumber.from(1000)))),
      makerNonces: makers.map(x => Math.floor(Math.random() * 1000000))
    }
    await settleBebopBlendAggregate(order, emptyHooks, makers, takerTransfersTypes, makerTransfersTypes, oldQuoteAggregate)
  });

  it('BebopBlend: AggregateOrder - One-to-Many with keeping positive slippage', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    let oldQuoteAggregate = {
      useOldAmount: true,
      makerAmounts: order.maker_amounts.map(maker_amounts => maker_amounts.map(x => BigNumber.from(x).sub(BigNumber.from(1000)))),
      makerNonces: makers.map(x => Math.floor(Math.random() * 1000000))
    }
    await settleBebopBlendAggregate(order, emptyHooks, makers, takerTransfersTypes, makerTransfersTypes, oldQuoteAggregate)
  });

  it('BebopBlend: AggregateOrder - One-to-Many with worse amounts', async function () {
    let makers = [fixture.bebopMaker, fixture.bebopMaker2]
    let [order, takerTransfersTypes, makerTransfersTypes] = getAggregateBlendOrder(
        "One-to-Many", fixture.settlement.address, makers.map(m => m.address), fixture.user.address
    )
    let oldQuoteAggregate = {
      useOldAmount: true,
      makerAmounts: order.maker_amounts.map(maker_amounts => maker_amounts.map(x => BigNumber.from(x).add(BigNumber.from(1000)))),
      makerNonces: makers.map(x => Math.floor(Math.random() * 1000000))
    }
    try {
      await settleBebopBlendAggregate(order, emptyHooks, makers, takerTransfersTypes, makerTransfersTypes, oldQuoteAggregate)
    } catch (e){
      return
    }
    throw new Error("Should revert with 0x711dbe4a error")
  });

});
