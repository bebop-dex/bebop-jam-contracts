import {getFixture} from './utils/fixture'
import {BigNumber, BigNumberish, utils} from "ethers";
import {
  JamHooks,
  JamInteraction, JamOrderStruct
} from "../../typechain-types/artifacts/src/JamSettlement";
import {PERMIT2_ADDRESS} from "./config";
import {
  addFeesAmounts,
  approveTokens, batchVerifyBalancesAfter, generatePartnerInfo,
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
import {expect} from "chai";

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
      partnerAddress: string = zeroAddress
  ) {
    const { user, settlement, solver, solverContract, directMaker } = fixture;

    // Approving takers tokens
    let nativeTokenAmount = await approveTokens(
        jamOrder.sellTokens, jamOrder.sellAmounts, user, jamOrder.usingPermit2 ? PERMIT2_ADDRESS: fixture.balanceManager.address
    )

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
      executor = user
      interactions = solverCalls
    } else {
      executor = directMaker
      interactions = []
    }

    let hooksHash = hooks === emptyHooks ? emptyHooksHash : utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    let signature
    if (jamOrder.usingPermit2){
      signature = await signPermit2AndJam(user, jamOrder, hooksHash, fixture.balanceManager.address)
    } else {
      if (executor.address === user.address){
        signature = "0x"
      } else {
        signature = await signJamOrder(user, jamOrder, hooksHash, settlement);
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
          jamOrder, signature, directSettleIncreasedAmounts, "0x", {value: nativeTokenAmount.toString()}
      );
    } else {
      res = await settlement.connect(executor).settle(
          jamOrder, signature, interactions, "0x", balanceRecipient, {value: nativeTokenAmount.toString()},
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
        jamOrder.nonce, jamOrder.receiver, jamOrder.sellTokens, jamOrder.buyTokens, jamOrder.sellAmounts, changedBuyAmounts
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
      partnerAddresses: string[] = []
  ) {
    const {  settlement, solver, solverContract } = fixture;

    // Approving takers tokens
    for (let i = 0; i < jamOrders.length; i++){
      await approveTokens(jamOrders[i].sellTokens, jamOrders[i].sellAmounts, users[i], jamOrders[i].usingPermit2 ? PERMIT2_ADDRESS: fixture.balanceManager.address);
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











  //
  // it('settleInternal', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls: JamInteraction.DataStruct[] = []
  //   await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
  //       buyTokenTransfers, null, false, false, true)
  // });
  //
  // it('settleInternal with increased buyAmounts', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls: JamInteraction.DataStruct[] = []
  //   let increasedBuyAmounts: BigNumberish[] = [(Number(jamOrder.buyAmounts[0]) + 1000).toString()]
  //
  //   await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
  //       buyTokenTransfers, null, false, false, true, increasedBuyAmounts)
  // });
  //
  // it('Permit2', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT2_THEN_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.user, jamOrder.sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  // });
  //
  // it('Permit2 - repeated', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  // });
  //
  // it('DAI-Permit', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT_THEN_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("UsingDaiPermit", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   let permitsData: Signature.TakerPermitsInfoStruct = await signPermit(
  //       fixture.user, TOKENS.DAI, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  // });
  //
  // it('ERC20-Permit', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT_THEN_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("ERC20-Permit", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   let permitsData: Signature.TakerPermitsInfoStruct = await signPermit(
  //       fixture.user, TOKENS.AAVE, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  // });
  //
  // it('Mix of Permit2 + Permit', async function () {
  //   let sellTokenTransfers: Commands[] = [
  //       //    UNI (permit)   WETH(traded before with Permit2)   LINK (permit2)    WBTC (permit2)
  //       Commands.CALL_PERMIT_THEN_TRANSFER, Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER
  //   ]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Permits-mix", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   let permitsDeadline: number = Math.floor(Date.now() / 1000) + 10000
  //   let fullPermitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.user, [TOKENS.LINK, TOKENS.WBTC], fixture.balanceManager.address, permitsDeadline
  //   )
  //   let extraPermitData: Signature.TakerPermitsInfoStruct = await signPermit(
  //       fixture.user, TOKENS.UNI, fixture.balanceManager.address, permitsDeadline
  //   )
  //   fullPermitsData.permitSignatures = extraPermitData.permitSignatures
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, fullPermitsData)
  // });
  //
  //
  //  //-----------------------------------------
  //  //
  //  //               Hooks tests
  //  //
  //  // -----------------------------------------
  //
  // it('beforeSettle hooks: Permit2', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //
  //   const takerPermit2 = await hooksGenerator.getHook_Permit2(jamOrder.sellTokens, fixture.balanceManager.address);
  //   const hooks: JamHooks.DefStruct = {
  //     beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 }],
  //     afterSettle: []
  //   }
  //   let emptyPermitsData: Signature.TakerPermitsInfoStruct = {
  //     permitSignatures: [],
  //     signatureBytesPermit2: "0x",
  //     noncesPermit2: [],
  //     deadline: 0
  //   }
  //   await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, emptyPermitsData)
  // });
  //
  // it('beforeSettle hooks: ERC20-Permit', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("SimpleReverse", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //
  //   const takerPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
  //   const hooks: JamHooks.DefStruct = {
  //     beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
  //     afterSettle: []
  //   }
  //   await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers,
  //       null, true, true)
  // });
  //
  // it('afterSettle hooks', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER, Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("BuyNativeAndWrapped", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   jamOrder.receiver = fixture.settlement.address
  //
  //   let bridgeAddress = BINANCE_ADDRESS // using transfers instead of real bridge tx
  //   let transferHook = await hooksGenerator.getHook_transferERC20(jamOrder.buyTokens[1], jamOrder.buyAmounts[1], bridgeAddress)
  //   const hooks: JamHooks.DefStruct = {
  //     beforeSettle: [],
  //     afterSettle: [
  //         { result: true, to: bridgeAddress, data: "0x", value: jamOrder.buyAmounts[0] },
  //         { result: true, to: TOKENS.WETH, data: transferHook.data!, value: "0" }
  //     ]
  //   }
  //   await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  // });
  //
  // it('afterSettle hooks with settleInternal', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)
  //   jamOrder.receiver = fixture.settlement.address
  //   const hooks: JamHooks.DefStruct = {
  //     beforeSettle: [],
  //     afterSettle: [{ result: true, to: BINANCE_ADDRESS, data: "0x", value: jamOrder.buyAmounts[0] }]
  //   }
  //   await settle(jamOrder, "0x", hooks, solverCalls, sellTokenTransfers,
  //       buyTokenTransfers, null, false, false, true)
  // });
  //
  // //-----------------------------------------
  // //
  // //             Extra tests
  // //
  // // -----------------------------------------
  //
  // it('Invalid executor', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address , sellTokenTransfers, buyTokenTransfers)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   try {
  //       await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  //   } catch (e) {
  //       return
  //   }
  //   throw Error("Error was expected")
  // });
  //
  // it('Limit order cancellation', async function () {
  //   // user places limit order by signing the order
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let jamOrder: JamOrder.DataStruct = getOrder(
  //       "Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, 10000,9999999999
  //   )!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //
  //   let isNonceValid = await fixture.settlement.isLimitOrderNonceValid(jamOrder.taker, jamOrder.nonce)
  //   if (!isNonceValid){
  //     throw Error("Nonce is not valid")
  //   }
  //   // user cancels this limit order
  //   await fixture.settlement.connect(fixture.user).cancelLimitOrder(jamOrder.nonce)
  //   try {
  //     // should fail because this limit order was cancelled
  //     await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  //   } catch (e){
  //     isNonceValid = await fixture.settlement.isLimitOrderNonceValid(jamOrder.taker, jamOrder.nonce)
  //     if (isNonceValid){
  //       throw Error("Nonce is still valid after canceling the order")
  //     }
  //     return
  //   }
  //   throw Error("Error was expected")
  // });
  //
  // //-----------------------------------------
  // //
  // //             PartialFill tests
  // //
  // // -----------------------------------------
  //
  // it('PartialFill simple', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let minFillPercent = 9000
  //   let curFillPercent = 9500
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, curFillPercent)
  //   await settle(
  //       jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers,null,
  //       true, false, false, [], curFillPercent
  //   )
  // });
  //
  // it('PartialFill with Permits', async function () {
  //   let sellTokenTransfers: Commands[] = [
  //     //    DYDX (permit)   WETH(traded before with Permit2)   SNX (permit2)
  //     Commands.CALL_PERMIT_THEN_TRANSFER, Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER
  //   ]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let minFillPercent = 9000
  //   let curFillPercent = 9000
  //   let jamOrder: JamOrder.DataStruct = getOrder("Permits-fresh-mix", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, curFillPercent)
  //   let permitsDeadline: number = Math.floor(Date.now() / 1000) + 10000
  //   let fullPermitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.user, [TOKENS.SNX], fixture.balanceManager.address, permitsDeadline
  //   )
  //   let extraPermitData: Signature.TakerPermitsInfoStruct = await signPermit(
  //       fixture.user, TOKENS.DYDX, fixture.balanceManager.address, permitsDeadline
  //   )
  //   fullPermitsData.permitSignatures = extraPermitData.permitSignatures
  //   await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, fullPermitsData,
  //       true, false, false, [], curFillPercent)
  // });
  //
  // it('PartialFill with settleInternal', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let minFillPercent = 9000
  //   let curFillPercent = 9200
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
  //   let solverCalls: JamInteraction.DataStruct[] = []
  //   await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
  //       buyTokenTransfers, null, false, false, true, [], curFillPercent)
  // });
  //
  // it('PartialFill with settleInternal+increased amounts', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let minFillPercent = 9000
  //   let curFillPercent = 9000
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
  //   let solverCalls: JamInteraction.DataStruct[] = []
  //   let increasedBuyAmounts: BigNumberish[] = [(Number(jamOrder.buyAmounts[0]) + 99999).toString()]
  //   await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
  //       buyTokenTransfers, null, false, false, true, increasedBuyAmounts, curFillPercent)
  // });
  //
  //
  // it('PartialFill fail - invalid percent', async function () {
  //   let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
  //   let minFillPercent = 9000
  //   let curFillPercent = 8999
  //   let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
  //   let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   try {
  //     await settle(
  //         jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers,null,
  //         true, false, false, [], curFillPercent
  //     )
  //   } catch (e){
  //       return
  //   }
  //   throw Error("Error was expected")
  // });
  //
  // //-----------------------------------------
  // //
  // //               Batch tests
  // //
  // // -----------------------------------------
  //
  // it('settleBatch simple', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
  //   let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
  //   let jamOrders: JamOrder.DataStruct[] = [
  //       getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
  //       getOrder("Simple", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   ]
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [],
  //     takersPermitsUsage: [],
  //     transferExactAmounts: true
  //   }
  //   await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
  //       batchSellTokenTransfers, batchBuyTokenTransfers, [], solverData)
  // });
  //
  // it('settleBatch same user', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.PERMIT2_TRANSFER], [Commands.SIMPLE_TRANSFER]]
  //   let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
  //   let jamOrders: JamOrder.DataStruct[] = [
  //     getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
  //     getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
  //     getOrder("SimpleReverse", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[2], batchBuyTokenTransfers[2])!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[2], bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   ]
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [],
  //     takersPermitsUsage: [],
  //     transferExactAmounts: true
  //   }
  //   await batchSettle([fixture.user, fixture.user, fixture.anotherUser], jamOrders, allSolverCalls,
  //       batchSellTokenTransfers, batchBuyTokenTransfers, [], solverData)
  // });
  //
  // it('settleBatch with permits', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.CALL_PERMIT2_THEN_TRANSFER], [Commands.CALL_PERMIT_THEN_TRANSFER]]
  //   let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
  //   let jamOrders: JamOrder.DataStruct[] = [
  //     getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
  //     getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
  //     getOrder("UsingDaiPermit", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[2], batchBuyTokenTransfers[2])!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[2], bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   ]
  //
  //   let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.user, jamOrders[1].sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //   let permitsDataAnotherUser: Signature.TakerPermitsInfoStruct = await signPermit(
  //       fixture.anotherUser, TOKENS.DAI, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [],
  //     takersPermitsUsage: [false, true, true],
  //     transferExactAmounts: true
  //   }
  //   await batchSettle([fixture.user, fixture.user, fixture.anotherUser], jamOrders, allSolverCalls,
  //       batchSellTokenTransfers, batchBuyTokenTransfers, [permitsData, permitsDataAnotherUser], solverData)
  // });
  //
  // it('settleBatch with excess', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [
  //       [Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER],
  //       [Commands.CALL_PERMIT2_THEN_TRANSFER]
  //   ]
  //   let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]]
  //   let jamOrders: JamOrder.DataStruct[] = [
  //     getOrder("Many-to-One", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
  //     getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   ]
  //
  //   let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.user, [TOKENS.LINK, TOKENS.WBTC], fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //   let permitsDataAnotherUser: Signature.TakerPermitsInfoStruct = await signPermit2(
  //       fixture.anotherUser, jamOrders[1].sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
  //   )
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [],
  //     takersPermitsUsage: [true, true],
  //     transferExactAmounts: false
  //   }
  //   await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls, batchSellTokenTransfers,
  //       batchBuyTokenTransfers, [permitsData, permitsDataAnotherUser], solverData)
  // });
  //
  // it('settleBatch with same tokens excess', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [[Commands.PERMIT2_TRANSFER], [Commands.PERMIT2_TRANSFER]]
  //   let batchBuyTokenTransfers: Commands[][] = [
  //       [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER],
  //     [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
  //   ]
  //   let jamOrders: JamOrder.DataStruct[] = [
  //     getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
  //     getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
  //   ]
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [],
  //     takersPermitsUsage: [],
  //     transferExactAmounts: false
  //   }
  //   await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
  //       batchSellTokenTransfers, batchBuyTokenTransfers,[], solverData)
  // });
  //
  // it('settleBatch with partial fills', async function () {
  //   let batchSellTokenTransfers: Commands[][] = [[Commands.PERMIT2_TRANSFER], [Commands.PERMIT2_TRANSFER]]
  //   let batchBuyTokenTransfers: Commands[][] = [
  //     [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER],
  //     [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
  //   ]
  //   let minFillPercent = 9000
  //   let jamOrders: JamOrder.DataStruct[] = [
  //     getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0], minFillPercent)!,
  //     getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1], minFillPercent)!,
  //   ]
  //   let allSolverCalls: JamInteraction.DataStruct[] = [
  //     ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker, minFillPercent),
  //     ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker, minFillPercent)
  //   ]
  //
  //   let solverData: ExecInfo.BatchSolverDataStruct = {
  //     balanceRecipient: fixture.solverContract.address,
  //     curFillPercents: [minFillPercent, minFillPercent],
  //     takersPermitsUsage: [],
  //     transferExactAmounts: false
  //   }
  //   await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
  //       batchSellTokenTransfers, batchBuyTokenTransfers,[], solverData, true)
  // });




});
