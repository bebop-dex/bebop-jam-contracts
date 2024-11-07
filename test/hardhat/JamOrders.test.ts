import {getFixture} from './utils/fixture'
import {BigNumber, BigNumberish, utils} from "ethers";
import {
  JamHooks,
  JamInteraction, JamOrderStruct
} from "../../typechain-types/artifacts/src/JamSettlement";
import {PERMIT2_ADDRESS, TOKENS} from "./config";
import {
  addFeesAmounts,
  approveTokens, batchVerifyBalancesAfter, createFakeJamOrder, encodeHooks, generatePartnerInfo,
  getAggregatedAmounts,
  getBalancesBefore,
  getBatchArrays, getBatchBalancesBefore,
  verifyBalancesAfter
} from "./utils/utils";
import {getOrder} from "./utils/jamOrders";
import {
  getBebopSolverCalls
} from "./blend/blendCalls";
import {HooksGenerator} from "./hooks/hooksGenerator";

import {BebopSettlement} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {signJamOrder, signPermit2AndJam} from "./signing/signJamOrder";
import {assert, expect} from "chai";
import {ethers, network} from "hardhat";
import {MaxUint256} from "@uniswap/permit2-sdk";

describe("JamOrders", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let hooksGenerator: HooksGenerator;

  const emptyHooks: JamHooks.DefStruct = {
    beforeSettle: [],
    afterSettle: []
  }
  const emptyHooksHash = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const zeroAddress = "0x0000000000000000000000000000000000000000"

  async function settle(
      jamOrder: JamOrderStruct,
      balanceRecipient: string,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[],
      usingSolverContract: boolean = true,
      directSettle: boolean = false,
      directSettleIncreasedAmounts: BigNumberish[] = [],
      userExcess: number = 0,
      solverExcess: number = 1000,
      protocolFee: BigNumber[] | undefined = undefined,
      partnerFee: BigNumber[] | undefined = undefined,
      partnerAddress: string = zeroAddress,
      skipTakerApprovals: boolean = false,
      _signer: SignerWithAddress | undefined = undefined
  ) {
    const { user, settlement, solver, solverContract, directMaker } = fixture;
    let signer = _signer === undefined ? user : _signer

    // Approving takers tokens
    let nativeTokenAmount = BigNumber.from(0)
    if (!skipTakerApprovals){
      nativeTokenAmount = await approveTokens(
          jamOrder.sellTokens, jamOrder.sellAmounts, signer, jamOrder.usingPermit2 ? PERMIT2_ADDRESS: fixture.balanceManager.address
      )
    }

    let changedBuyAmounts: BigNumber[];
    if (directSettle) {
      changedBuyAmounts = JSON.parse(JSON.stringify(directSettleIncreasedAmounts.length > 0 ? directSettleIncreasedAmounts : jamOrder.buyAmounts))
      if (protocolFee !== undefined) {
        changedBuyAmounts = changedBuyAmounts.map((amount, i) => BigNumber.from(amount).sub(protocolFee[i]))
      }
      if (partnerFee !== undefined) {
          changedBuyAmounts = changedBuyAmounts.map((amount, i) => BigNumber.from(amount).sub(partnerFee[i]))
      }
    } else {
      changedBuyAmounts = jamOrder.buyAmounts.map((amount) => BigNumber.from(amount).add(userExcess))
    }

    let interactions: JamInteraction.DataStruct[];
    let executor = solver;
    if (usingSolverContract) {
      let transferToJam: BigNumber[] = changedBuyAmounts
      if (protocolFee !== undefined) {
        transferToJam = transferToJam.map((amount, i) => BigNumber.from(amount).add(protocolFee[i]))
      }
      if (partnerFee !== undefined) {
          transferToJam = transferToJam.map((amount, i) => BigNumber.from(amount).add(partnerFee[i]))
      }
      let executeOnSolverContract = await solverContract.populateTransaction.simpleExecute(
          solverCalls, jamOrder.buyTokens, transferToJam, settlement.address
      );
      let value = balanceRecipient === fixture.settlement.address ? nativeTokenAmount.toString() : "0"
      interactions = [
        { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: value }
      ]
    } else if (!directSettle){
      executor = signer
      interactions = solverCalls
    } else {
      executor = directMaker
      interactions = []
    }

    let hooksHash = hooks === emptyHooks ? emptyHooksHash : utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    assert(hooksHash === await settlement.hashHooks(hooks))
    let encodedHooks = hooks === emptyHooks ? "0x" : encodeHooks(hooks);
    let signature
    if (jamOrder.usingPermit2){
      signature = await signPermit2AndJam(signer, jamOrder, hooksHash, fixture.balanceManager.address)
    } else {
      if (executor.address === jamOrder.taker){
        signature = "0x"
      } else {
        signature = await signJamOrder(signer, jamOrder, hooksHash, settlement);
      }
    }

    let userBalancesBefore = await getBalancesBefore(jamOrder.buyTokens, jamOrder.receiver)
    let solverBalancesBefore = await getBalancesBefore(jamOrder.buyTokens, solverContract.address)
    let partnerBalanceBefore  = await getBalancesBefore(jamOrder.buyTokens, partnerAddress)
    let treasuryBalanceBefore  = await getBalancesBefore(jamOrder.buyTokens, fixture.treasuryAddress.address)

    let res;
    if (directSettle) {
      // approve directMaker tokens
      await approveTokens(jamOrder.buyTokens, directSettleIncreasedAmounts.length > 0 ?
              directSettleIncreasedAmounts : changedBuyAmounts, directMaker, fixture.balanceManager.address)
      res = await settlement.connect(executor).settleInternal(
          jamOrder, signature, directSettleIncreasedAmounts, encodedHooks, {value: nativeTokenAmount.toString()}
      );
    } else {
      res = await settlement.connect(executor).settle(
          jamOrder, signature, interactions, encodedHooks, balanceRecipient, {value: nativeTokenAmount.toString()},
      );
    }
    await verifyBalancesAfter(
        jamOrder.buyTokens,  jamOrder.receiver, jamOrder.receiver === fixture.settlement.address ?
            changedBuyAmounts.map(_ => BigNumber.from(0)) : changedBuyAmounts, userBalancesBefore
    )
    await verifyBalancesAfter(
        jamOrder.buyTokens,  solverContract.address, changedBuyAmounts.map(_ => usingSolverContract ?
            BigNumber.from(solverExcess) : BigNumber.from(0)), solverBalancesBefore, 1
    )
    if (protocolFee !== undefined){
        await verifyBalancesAfter(
            jamOrder.buyTokens, fixture.treasuryAddress.address, protocolFee, treasuryBalanceBefore
        )
    }
    if (partnerFee !== undefined){
      await verifyBalancesAfter(
          jamOrder.buyTokens, partnerAddress, partnerFee, partnerBalanceBefore
      )
    }
    await expect(res).to.emit(settlement, "BebopJamOrderFilled").withArgs(
        jamOrder.nonce, jamOrder.taker, jamOrder.sellTokens, jamOrder.buyTokens, jamOrder.sellAmounts, changedBuyAmounts
    )
  }

  async function batchSettle(
      users: SignerWithAddress[],
      jamOrders: JamOrderStruct[],
      batchSolverCalls: JamInteraction.DataStruct[],
      balanceRecipient: string,
      userExcess: number = 0,
      protocolFees: BigNumber[][] | undefined = undefined,
      partnerFees: BigNumber[][] | undefined = undefined,
      partnerAddresses: string[] = [],
      infApproval: boolean = false
  ) {
    const {  settlement, solver, solverContract } = fixture;

    // Approving takers tokens
    for (let i = 0; i < jamOrders.length; i++){
      await approveTokens(jamOrders[i].sellTokens, infApproval ? jamOrders[i].sellAmounts.map(_ => MaxUint256) : jamOrders[i].sellAmounts,
          users[i], jamOrders[i].usingPermit2 ? PERMIT2_ADDRESS: fixture.balanceManager.address);
    }

    let executor = solver;
    let [batchAmounts, batchAddresses] = getBatchArrays(jamOrders, userExcess, protocolFees, partnerFees)
    let executeOnSolverContract = await solverContract.populateTransaction.simpleExecute(
        batchSolverCalls, batchAddresses, batchAmounts, settlement.address
    );
    let interactions: JamInteraction.DataStruct[] = [
      { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: "0"}
    ]

    let signatures: string[] = []
    for (let i = 0; i < jamOrders.length; i++){
      if (jamOrders[i].usingPermit2){
        signatures.push(await signPermit2AndJam(users[i], jamOrders[i], emptyHooksHash, fixture.balanceManager.address));
      } else {
        signatures.push((await signJamOrder(users[i], jamOrders[i], emptyHooksHash, settlement)));
      }
    }
    let aggregatedBuyAmounts = getAggregatedAmounts(jamOrders)
    if (protocolFees !== undefined){
      addFeesAmounts(aggregatedBuyAmounts, jamOrders, protocolFees, jamOrders.map(_ => fixture.treasuryAddress.address))
    }
    if (partnerFees !== undefined){
      addFeesAmounts(aggregatedBuyAmounts, jamOrders, partnerFees, partnerAddresses)
    }
    let allBalancesBefore = await getBatchBalancesBefore(jamOrders, [fixture.treasuryAddress.address,...partnerAddresses])
    await settlement.connect(executor).settleBatch(
        jamOrders, signatures, interactions, [], balanceRecipient, {value: "0"}
    )
    await batchVerifyBalancesAfter(allBalancesBefore, aggregatedBuyAmounts)
  }

  before(async () => {
    fixture = await getFixture();
    bebop = fixture.bebopBlend
    hooksGenerator = new HooksGenerator(fixture.user)
  });

  //-----------------------------------------
  //
  //               settle
  //
  // -----------------------------------------

  it('JAM: settle - Simple with Permit2', async function () {
      let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, true)!
      let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - Simple with standard approvals', async function () {
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - Many-to-One with Permit2', async function () {
    let jamOrder: JamOrderStruct = getOrder("Many-to-One", fixture.user.address, fixture.solver.address, true)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - Many-to-One with standard approvals', async function () {
    let jamOrder: JamOrderStruct = getOrder("Many-to-One", fixture.user.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - One-to-Many', async function () {
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.solver.address, true)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - Many-to-Many', async function () {
    let jamOrder: JamOrderStruct = getOrder("Many-to-Many", fixture.user.address, fixture.solver.address, true)!
    let solverCalls0 = await getBebopSolverCalls(createFakeJamOrder(jamOrder, 0), bebop, fixture.solverContract.address, fixture.bebopMaker)
    let solverCalls1 = await getBebopSolverCalls(createFakeJamOrder(jamOrder, 1), bebop, fixture.solverContract.address, fixture.bebopMaker)
    let solverCalls = solverCalls0.concat(solverCalls1)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - One-to-Many with user excess', async function () {
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.solver.address, true)!
    let excess = 1500
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, excess)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true, false,
        [], excess, 0)
  });

  it('JAM: settle - One-to-Many with user and solver excess', async function () {
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.solver.address, true)!
    let excess = 1500
    let userExcess = 800
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, excess)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true, false,
        [], userExcess, excess - userExcess)
  });

  it('JAM: settle - Without solver-contract, Permit2', async function () {
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, zeroAddress, true)!
    let excess = 2000;
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker, excess)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, false, false,
        [], excess, 0)
  });

  it('JAM: settle - Without solver-contract, standard approvals', async function () {
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.user.address, false)!
    let excess = 0;
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker, excess)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, false, false,
        [], excess, 0)
  });

  it('JAM: settle - SellNative, without solver contract', async function () {
    let jamOrder: JamOrderStruct = getOrder("SellNative", fixture.user.address, zeroAddress, false)!
    let excess = 1000;
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker, excess)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, false, false,
        [], excess, 0)
  });

  it('JAM: settle - SellNative, taker=solver', async function () {
    let jamOrder: JamOrderStruct = getOrder("SellNative", fixture.user.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - BuyNative', async function () {
    let jamOrder: JamOrderStruct = getOrder("BuyNative", fixture.user.address, fixture.solver.address, true)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - BuyNativeAndWrapped', async function () {
    let jamOrder: JamOrderStruct = getOrder("BuyNativeAndWrapped", fixture.user.address, fixture.solver.address, true)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
  });

  it('JAM: settle - Protocol fee', async function () {
    let protocolFeeBps = 100
    let partnerInfo  = generatePartnerInfo(zeroAddress, 0, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, true, partnerInfo)!
    let feeExcess = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - protocolFeeBps).sub(BigNumber.from(amount)))
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, feeExcess)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true,
        false, [], 0, 0, feeExcess)
  });

  it('JAM: settle - Partner fee', async function () {
    let partnerFeeBps = 123
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, 0)
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, true, partnerInfo)!
    let feeExcess = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps).sub(BigNumber.from(amount)))
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, feeExcess)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true,
        false, [], 0, 0, undefined, feeExcess, fixture.anotherUser.address)
  });

  it('JAM: settle - Protocol fee & Partner fee', async function () {
    let protocolFeeBps = 100
    let partnerFeeBps = 200
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, true, partnerInfo)!
    let feeExcess = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
    let protocolFee = feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps))
    let partnerFee = feeExcess.map(amount => BigNumber.from(amount).mul(partnerFeeBps).div(protocolFeeBps + partnerFeeBps))
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, feeExcess)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true,
        false, [], 0, 0, protocolFee, partnerFee, fixture.anotherUser.address)
  });

  it('JAM: settle - Protocol fee & Partner fee without solver contract', async function () {
    let protocolFeeBps = 400
    let partnerFeeBps = 400
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("SimpleUSDT", fixture.user.address, zeroAddress, false, partnerInfo)!
    let feeExcess = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
    let protocolFee = feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps))
    let partnerFee = feeExcess.map(amount => BigNumber.from(amount).mul(partnerFeeBps).div(protocolFeeBps + partnerFeeBps))
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker, feeExcess)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, false, false,
        [], 0, 0, protocolFee, partnerFee, fixture.anotherUser.address)
  });

  it('JAM: settle - Protocol&Partner fee and userExcess', async function () {
    let protocolFeeBps = 100
    let partnerFeeBps = 200
    let userExcess = 12345
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, true, partnerInfo)!
    let amountsWithUserExcess: BigNumber[] = jamOrder.buyAmounts.map(a => BigNumber.from(a).add(userExcess))
    let feeExcess = amountsWithUserExcess.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
    let protocolFee = feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps))
    let partnerFee = feeExcess.map(amount => BigNumber.from(amount).mul(partnerFeeBps).div(protocolFeeBps + partnerFeeBps))
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address,
        fixture.bebopMaker, feeExcess.map(amount => amount.add(userExcess)))
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true,
        false, [], userExcess, 0, protocolFee, partnerFee, fixture.anotherUser.address)
  });


  //-----------------------------------------
  //
  //               settleInternal
  //
  // -----------------------------------------

  it('JAM: settleInternal - Simple with Permit2', async function () {
      let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, true)!
      await settle(jamOrder, "0x", emptyHooks, [],false, true)
  });

  it('JAM: settleInternal - Simple with standard approvals', async function () {
    let jamOrder: JamOrderStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, false)!
    await settle(jamOrder, "0x", emptyHooks, [],false, true)
  });

  it('JAM: settleInternal - Many-to-One with Permit2', async function () {
    let jamOrder: JamOrderStruct = getOrder("Many-to-One", fixture.user.address, fixture.directMaker.address, true)!
    await settle(jamOrder, "0x", emptyHooks, [],false, true)
  });

  it('JAM: settleInternal - One-to-Many with fees', async function () {
    let protocolFeeBps = 200
    let partnerFeeBps = 300
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.directMaker.address, false, partnerInfo)!
    let feeExcess = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
    let protocolFee = feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps))
    let partnerFee = feeExcess.map(amount => BigNumber.from(amount).mul(partnerFeeBps).div(protocolFeeBps + partnerFeeBps))
    let increasedBuyAmounts = jamOrder.buyAmounts.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps))
    await settle(jamOrder, "0x", emptyHooks, [],false, true, increasedBuyAmounts,
        0, 0, protocolFee, partnerFee, fixture.anotherUser.address)
  });

  it('JAM: settleInternal - One-to-Many with increased amounts', async function () {
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.directMaker.address, false)!
    let increasedBuyAmounts = jamOrder.buyAmounts.map(a => BigNumber.from(a).add(1000))
    await settle(jamOrder, "0x", emptyHooks, [],false, true, increasedBuyAmounts)
  });

  it('JAM: settleInternal - One-to-Many with increased amounts and fees', async function () {
    let protocolFeeBps = 4000
    let partnerFeeBps = 5000
    let partnerInfo  = generatePartnerInfo(fixture.anotherUser.address, partnerFeeBps, protocolFeeBps)
    let jamOrder: JamOrderStruct = getOrder("One-to-Many", fixture.user.address, fixture.directMaker.address, false, partnerInfo)!
    let userExcess = 12345
    let amountsWithUserExcess = jamOrder.buyAmounts.map(a => BigNumber.from(a).add(userExcess))
    let feeExcess = amountsWithUserExcess.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
    let protocolFee = feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps))
    let partnerFee = feeExcess.map(amount => BigNumber.from(amount).mul(partnerFeeBps).div(protocolFeeBps + partnerFeeBps))
    let increasedBuyAmounts = amountsWithUserExcess.map(amount =>
        BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps))
    await settle(jamOrder, "0x", emptyHooks, [],false, true, increasedBuyAmounts,
        userExcess, 0, protocolFee, partnerFee, fixture.anotherUser.address)
  });


  //-----------------------------------------
  //
  //               settleBatch
  //
  // -----------------------------------------

  it('JAM: settleBatch - Simple', async function () {
    let jamOrders: JamOrderStruct[] = [
        getOrder("Simple", fixture.user.address, fixture.solver.address, false)!,
        getOrder("Simple", fixture.anotherUser.address, fixture.solver.address, true)!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    await batchSettle([fixture.user, fixture.anotherUser], jamOrders, allSolverCalls, fixture.solverContract.address)
  });

  it('JAM: settleBatch - Simple with same user, same tokems', async function () {
    let jamOrders: JamOrderStruct[] = [
      getOrder("Simple", fixture.user.address, fixture.solver.address, true)!,
      getOrder("Many-to-One", fixture.user.address, fixture.solver.address, true)!,
      getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, false)!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[2], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    await batchSettle([fixture.user, fixture.user, fixture.anotherUser], jamOrders, allSolverCalls, fixture.solverContract.address, 0,
      undefined, undefined, [], true)
  });

  it('JAM: settleBatch - Partner&Protocol fee', async function () {
    let protocolFeeBps = 200
    let partnerFeeBps = 300
    let partners = [fixture.deployer.address, fixture.deployer.address]
    let jamOrders: JamOrderStruct[] = [
      getOrder("Simple", fixture.user.address, fixture.solver.address, false,
          generatePartnerInfo(partners[0], partnerFeeBps, protocolFeeBps))!,
      getOrder("SimpleUSDT", fixture.anotherUser.address, fixture.solver.address, true,
          generatePartnerInfo(partners[1], partnerFeeBps, protocolFeeBps))!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = []
    let protocolFees: BigNumber[][] = []
    let partnerFees: BigNumber[][] = []
    for (let jamOrder of jamOrders){
        let feeExcess = jamOrder.buyAmounts.map(amount =>
          BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps - protocolFeeBps).sub(BigNumber.from(amount)))
        protocolFees.push(feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps).div(protocolFeeBps + partnerFeeBps)))
        partnerFees.push(feeExcess.map((amount, i) => amount.sub(protocolFees[protocolFees.length - 1][i])))
        allSolverCalls.push(...await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, feeExcess))
    }

    await batchSettle([fixture.user, fixture.anotherUser], jamOrders, allSolverCalls, fixture.solverContract.address, 0,
        protocolFees, partnerFees, partners)
  });

  it('JAM: settleBatch - One-to-Many with fees and excess', async function () {
    let protocolFeeBps = [300, 200]
    let partnerFeeBps = [100, 200]
    let partners = [fixture.deployer.address, fixture.directMaker.address]
    let jamOrders: JamOrderStruct[] = [
      getOrder("One-to-Many", fixture.user.address, fixture.solver.address, true,
          generatePartnerInfo(partners[0], partnerFeeBps[0], protocolFeeBps[0]))!,
      getOrder("SimpleWETH", fixture.anotherUser.address, fixture.solver.address, false,
          generatePartnerInfo(partners[1], partnerFeeBps[1], protocolFeeBps[1]))!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = []
    let protocolFees: BigNumber[][] = []
    let partnerFees: BigNumber[][] = []
    let userExcess = 1000
    let amountsWithUserExcess: BigNumber[][] = jamOrders.map(jamOrder => jamOrder.buyAmounts.map(a => BigNumber.from(a).add(userExcess)))
    for (let [ind, jamOrder] of jamOrders.entries()){
      let feeExcess = amountsWithUserExcess[ind].map((amount, i) =>
          BigNumber.from(amount).mul(10000).div(10000 - partnerFeeBps[ind] - protocolFeeBps[ind]).sub(BigNumber.from(amount)))
      protocolFees.push(feeExcess.map(amount => BigNumber.from(amount).mul(protocolFeeBps[ind]).div(protocolFeeBps[ind] + partnerFeeBps[ind])))
      partnerFees.push(feeExcess.map((amount, i) => amount.sub(protocolFees[protocolFees.length - 1][i])))
      allSolverCalls.push(...await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker,
          feeExcess.map(amount => amount.add(userExcess))))
    }

    await batchSettle([fixture.user, fixture.anotherUser], jamOrders, allSolverCalls, fixture.solverContract.address, userExcess,
        protocolFees, partnerFees, partners)
  });


   //-----------------------------------------
   //
   //               Hooks tests
   //
   // -----------------------------------------

  it('JAM: beforeSettle hooks - ERC20-Permit', async function () {
    let jamOrder = getOrder("SimpleWETH", fixture.user.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, true, false, [],
    0, 1000, undefined, undefined, zeroAddress, true)
  });

  it('JAM: beforeSettle hooks - DAI-Permit', async function () {
    let jamOrder = getOrder("UsingDaiPermit", fixture.user.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    const takerPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, true, false, [],
        0, 1000, undefined, undefined, zeroAddress, true)
  });

  it('JAM: afterSettle hooks', async function () {
    let jamOrder = getOrder("BuyNative", fixture.user.address, fixture.solver.address, false)!
    jamOrder.receiver = fixture.settlement.address
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    const hookForWrapping = await hooksGenerator.getHook_wrapNative(jamOrder.buyAmounts[0]);
    const hookForTransfer = await hooksGenerator.getHook_transferERC20(TOKENS.WETH, jamOrder.buyAmounts[0], fixture.user.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: [
        { result: true, to: hookForWrapping.to!, data: hookForWrapping.data!, value: hookForWrapping.value! }, // wrap native token
        { result: true, to: hookForTransfer.to!, data: hookForTransfer.data!, value: hookForTransfer.value || "0" } // send to user
      ]
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls)
  });

  //-----------------------------------------
  //
  //             Extra tests
  //
  // -----------------------------------------

  it('JAM: Invalid executor', async function () {
    let exclusiveDeadline = (await ethers.provider.getBlock("latest")).timestamp + 3;
    let expiry = exclusiveDeadline + 1000;
    let jamOrder: JamOrderStruct = getOrder(
        "Simple", fixture.user.address, fixture.anotherUser.address, true, undefined, expiry, exclusiveDeadline
    )!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    try {
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
    } catch (e) {
      for (let i = 0; i < 5; i++) {
        await network.provider.send('evm_mine');
      }
      // should pass because the exclusive deadline is over
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
      return
    }
    throw Error("Error was expected")
  });

  it('JAM: Limit order cancellation', async function () {
    let jamOrder: JamOrderStruct = getOrder(
        "Simple", fixture.user.address, fixture.solver.address, true, undefined, 9999999999
    )!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    let isNonceValid = await fixture.settlement.isLimitOrderNonceValid(jamOrder.taker, jamOrder.nonce)
    if (!isNonceValid){
      throw Error("Nonce is not valid")
    }
    // user cancels this limit order
    await fixture.settlement.connect(fixture.user).cancelLimitOrder(jamOrder.nonce)
    try {
      // should fail because this limit order was cancelled
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls)
    } catch (e){
      isNonceValid = await fixture.settlement.isLimitOrderNonceValid(jamOrder.taker, jamOrder.nonce)
      if (isNonceValid){
        throw Error("Nonce is still valid after canceling the order")
      }
      return
    }
    throw Error("Error was expected")
  });

  it('JAM: taker with smart wallet, standard approvals', async function () {
    let jamOrder = getOrder("SimpleWETH", fixture.takerSmartWallet.address, fixture.solver.address, false)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await fixture.takerSmartWallet.connect(fixture.deployer).approve(jamOrder.sellTokens[0], fixture.balanceManager.address)

    try {
      // should fail, because signer is not added
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true, false, [],
          0, 1000, undefined, undefined, zeroAddress, true, fixture.anotherUser)
    } catch (e){
      await fixture.takerSmartWallet.connect(fixture.deployer).addSigner(fixture.anotherUser.address)
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true, false, [],
          0, 1000, undefined, undefined, zeroAddress, true, fixture.anotherUser)
      return
    }
    throw Error("Error was expected")
  });

  it('JAM: taker with smart wallet, permit2', async function () {
    let jamOrder = getOrder("SimpleMKR", fixture.takerSmartWallet.address, fixture.solver.address, true)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await fixture.takerSmartWallet.connect(fixture.deployer).approve(jamOrder.sellTokens[0], PERMIT2_ADDRESS)
    await fixture.takerSmartWallet.connect(fixture.deployer).addSigner(fixture.anotherUser.address)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, true, false, [],
        0, 1000, undefined, undefined, zeroAddress, true, fixture.anotherUser)
  });

});
