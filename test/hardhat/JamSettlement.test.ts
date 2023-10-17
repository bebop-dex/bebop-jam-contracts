import {waffle} from "hardhat";
import {getFixture} from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, BigNumberish, utils} from "ethers";
import {
  ExecInfo,
  JamHooks,
  JamInteraction,
  JamOrder,
  JamSettlement,
  Signature
} from "../../typechain-types/artifacts/src/JamSettlement";
import {BINANCE_ADDRESS, PERMIT2_ADDRESS, TOKENS} from "./config";
import {
  approveTokens, batchVerifyBalancesAfter,
  getAggregatedAmounts,
  getBalancesBefore,
  getBatchArrays, getBatchBalancesBefore,
  signJamOrder,
  verifyBalancesAfter
} from "./utils/utils";
import {Commands, getOrder} from "./utils/orders";
import {getBebopSolverCalls} from "./bebop/bebop-utils";
import {HooksGenerator} from "./hooks/hooksGenerator";
import {signPermit, signPermit2} from "./utils/permits";
import {BebopSettlement} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";


describe("JamSettlement", function () {
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
      jamOrder: JamOrder.DataStruct,
      balanceRecipient: string,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[],
      sellTokensTransfers: Commands[],
      buyTokensTransfers: Commands[],
      takerPermitsInfo: Signature.TakerPermitsInfoStruct | null = null,
      usingSolverContract: boolean = true,
      skipTakerApprovals: boolean = false,
      directSettle: boolean = false,
      directSettleIncreasedAmounts: BigNumberish[] = [],
      curFillPercent: number = 10000
  ) {
    const { user, settlement, solver, solverContract, directMaker } = fixture;

    // Approving takers tokens
    let nativeTokenAmount = BigNumber.from(0)
    if (!skipTakerApprovals) {
      nativeTokenAmount = await approveTokens(jamOrder.sellTokens, jamOrder.sellAmounts, sellTokensTransfers, user, fixture.balanceManager.address);
    }

    // Change buy amounts
    let changedBuyAmounts = JSON.parse(JSON.stringify(directSettleIncreasedAmounts.length > 0 ? directSettleIncreasedAmounts : jamOrder.buyAmounts))
    if (curFillPercent !== 10000){
      for (let i = 0; i < changedBuyAmounts.length; i++){
        changedBuyAmounts[i] = BigNumber.from(changedBuyAmounts[i]).mul(curFillPercent).div(10000)
      }
    }

    let interactions: JamInteraction.DataStruct[];
    let executor = solver;
    let solverExcess = 1000
    if (usingSolverContract) {
      let executeOnSolverContract = await solverContract.populateTransaction.execute(
          solverCalls, jamOrder.buyTokens, changedBuyAmounts, jamOrder.buyNFTIds, jamOrder.buyTokenTransfers, settlement.address
      );
      interactions = [
        { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: nativeTokenAmount.toString() }
      ]
    } else {
      executor = user
      interactions = solverCalls
    }

    jamOrder.hooksHash = hooks === emptyHooks ? emptyHooksHash: utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    const signature = await signJamOrder(user, jamOrder, settlement);

    let [userBalancesBefore, solverBalancesBefore] = await getBalancesBefore(
        jamOrder.buyTokens, jamOrder.receiver, buyTokensTransfers, jamOrder.buyNFTIds, solverContract.address)

    if (directSettle) {
      nativeTokenAmount = await approveTokens(jamOrder.buyTokens, changedBuyAmounts, buyTokensTransfers, directMaker, fixture.balanceManager.address)
      const makerData: ExecInfo.MakerDataStruct = {increasedBuyAmounts: directSettleIncreasedAmounts, curFillPercent}
      if (takerPermitsInfo === null) {
        await settlement.connect(directMaker).settleInternal(jamOrder, signature, hooks, makerData, {value: nativeTokenAmount.toString()});
      } else {
        await settlement.connect(directMaker).settleInternalWithPermitsSignatures(
            jamOrder, signature, takerPermitsInfo, hooks, makerData, {value: nativeTokenAmount.toString()}
        );
      }
    } else {
      const solverData: ExecInfo.SolverDataStruct = {balanceRecipient, curFillPercent}
        if (takerPermitsInfo === null) {
          await settlement.connect(executor).settle(
              jamOrder, signature, interactions, hooks, solverData, {value: nativeTokenAmount.toString()}
          );
        } else {
          await settlement.connect(executor).settleWithPermitsSignatures(
              jamOrder, signature, takerPermitsInfo, interactions, hooks, solverData, {value: nativeTokenAmount.toString()}
          );
        }
    }

    await verifyBalancesAfter(jamOrder.buyTokens, jamOrder.receiver, sellTokensTransfers, buyTokensTransfers, jamOrder.buyNFTIds, solverContract.address,
        usingSolverContract, changedBuyAmounts, solverExcess, userBalancesBefore, solverBalancesBefore, directSettle, settlement.address)
  }

  async function batchSettle(
      users: SignerWithAddress[],
      jamOrders: JamOrder.DataStruct[],
      batchSolverCalls: JamInteraction.DataStruct[],
      batchSellTokensTransfers: Commands[][],
      batchBuyTokensTransfers: Commands[][],
      batchTakerPermitsInfo: Signature.TakerPermitsInfoStruct[],
      solverData: ExecInfo.BatchSolverDataStruct,
      takerGetExcess: boolean = false
  ) {
    const {  settlement, solver, solverContract } = fixture;

    // Approving takers tokens
    for (let i = 0; i < jamOrders.length; i++){
      await approveTokens(jamOrders[i].sellTokens, jamOrders[i].sellAmounts, batchSellTokensTransfers[i], users[i], fixture.balanceManager.address)
    }

    let executor = solver;
    let solverExcess = 1000
    let [batchAmounts, batchAddresses, batchNftIds, batchTokenTransfers] = getBatchArrays(jamOrders, solverData.curFillPercents, takerGetExcess ? solverExcess : 0)
    let executeOnSolverContract = await solverContract.populateTransaction.execute(
        batchSolverCalls, batchAddresses, batchAmounts, batchNftIds, batchTokenTransfers, settlement.address
    );
    let interactions: JamInteraction.DataStruct[] = [
      { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: "0"}
    ]

    let signatures: Signature.TypedSignatureStruct[] = []
    for (let i = 0; i < jamOrders.length; i++){
      jamOrders[i].hooksHash = emptyHooksHash
      signatures.push(await signJamOrder(users[i], jamOrders[i], settlement));
    }

    let aggregatedBuyAmounts = getAggregatedAmounts(jamOrders, solverData.curFillPercents)
    let allBalancesBefore = await getBatchBalancesBefore(jamOrders, batchBuyTokensTransfers, solverContract.address)

    await settlement.connect(executor).settleBatch(
        jamOrders, signatures, batchTakerPermitsInfo, interactions, [], solverData, {value: "0"}
    )

    await batchVerifyBalancesAfter(solverContract.address, settlement.address, solverExcess, allBalancesBefore, aggregatedBuyAmounts, takerGetExcess)

  }

  before(async () => {
    fixture = await getFixture();
    bebop = await waffle.deployContract(fixture.deployer, BebopSettlementABI, [
      TOKENS.WETH,
      PERMIT2_ADDRESS,
      TOKENS.DAI
    ]) as BebopSettlement;
    hooksGenerator = new HooksGenerator(fixture.user)
  });

  it('Simple BebopSettlement', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address , sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Many-to-one', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Many-to-One", fixture.user.address, zeroAddress, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('One-to-Many', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("One-to-Many", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Many-to-Many', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Many-to-Many", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Taker execution with Native token', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellNative", fixture.user.address, fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers,null, false)
  });

  it('Native token transfer to taker', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('settleInternal', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('settleInternal with increased buyAmounts', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    let increasedBuyAmounts: BigNumberish[] = [(Number(jamOrder.buyAmounts[0]) + 1000).toString()]

    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true, increasedBuyAmounts)
  });

  it('Permit2', async function () {
    let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT2_THEN_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.user, jamOrder.sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  });

  it('Permit2 - repeated', async function () {
    let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('DAI-Permit', async function () {
    let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT_THEN_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("UsingDaiPermit", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    let permitsData: Signature.TakerPermitsInfoStruct = await signPermit(
        fixture.user, TOKENS.DAI, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  });

  it('ERC20-Permit', async function () {
    let sellTokenTransfers: Commands[] = [Commands.CALL_PERMIT_THEN_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("ERC20-Permit", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    let permitsData: Signature.TakerPermitsInfoStruct = await signPermit(
        fixture.user, TOKENS.AAVE, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, permitsData)
  });

  it('Mix of Permit2 + Permit', async function () {
    let sellTokenTransfers: Commands[] = [
        //    UNI (permit)   WETH(traded before with Permit2)   LINK (permit2)    WBTC (permit2)
        Commands.CALL_PERMIT_THEN_TRANSFER, Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER
    ]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Permits-mix", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    let permitsDeadline: number = Math.floor(Date.now() / 1000) + 10000
    let fullPermitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.user, [TOKENS.LINK, TOKENS.WBTC], fixture.balanceManager.address, permitsDeadline
    )
    let extraPermitData: Signature.TakerPermitsInfoStruct = await signPermit(
        fixture.user, TOKENS.UNI, fixture.balanceManager.address, permitsDeadline
    )
    fullPermitsData.permitSignatures = extraPermitData.permitSignatures
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, fullPermitsData)
  });

  //-----------------------------------------
  //
  //               NFTs tests
  //
  // -----------------------------------------

  it('Buy NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC721", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Buy NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC1155", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Sell NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC721", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Sell NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC1155", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('settleInternal Buy NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC721-Repeated", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('settleInternal Buy NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC1155-Repeated", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('settleInternal Sell NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC721-Repeated", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('settleInternal Sell NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC1155-Repeated", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('NFT-to-NFT', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFT-to-NFT", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('NFTs-to-NFTs', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER, Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER, Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFTs-to-NFTs", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('NFT-to-NFT+ETH', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER, Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFT-to-NFT+ETH", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  it('WETH+NFT-to-NFT', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER, Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("WETH+NFT-to-NFT", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });


   //-----------------------------------------
   //
   //               Hooks tests
   //
   // -----------------------------------------

  it('beforeSettle hooks: Permit2', async function () {
    let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit2 = await hooksGenerator.getHook_Permit2(jamOrder.sellTokens, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 }],
      afterSettle: []
    }
    let emptyPermitsData: Signature.TakerPermitsInfoStruct = {
      permitSignatures: [],
      signatureBytesPermit2: "0x",
      noncesPermit2: [],
      deadline: 0
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, emptyPermitsData)
  });

  it('beforeSettle hooks: ERC20-Permit', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SimpleReverse", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers,
        null, true, true)
  });

  it('afterSettle hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNativeAndWrapped", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    jamOrder.receiver = fixture.settlement.address

    let bridgeAddress = BINANCE_ADDRESS // using transfers instead of real bridge tx
    let transferHook = await hooksGenerator.getHook_transferERC20(jamOrder.buyTokens[1], jamOrder.buyAmounts[1], bridgeAddress)
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: [
          { result: true, to: bridgeAddress, data: "0x", value: jamOrder.buyAmounts[0] },
          { result: true, to: TOKENS.WETH, data: transferHook.data!, value: "0" }
      ]
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('afterSettle hooks with settleInternal', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)
    jamOrder.receiver = fixture.settlement.address
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: [{ result: true, to: BINANCE_ADDRESS, data: "0x", value: jamOrder.buyAmounts[0] }]
    }
    await settle(jamOrder, "0x", hooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true)
  });

  //-----------------------------------------
  //
  //             Extra tests
  //
  // -----------------------------------------

  it('Invalid executor', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address , sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    try {
        await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
    } catch (e) {
        return
    }
    throw Error("Error was expected")
  });

  it('Limit order cancellation', async function () {
    // user places limit order by signing the order
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder(
        "Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, 10000,9999999999
    )!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    let isNonceValid = await fixture.settlement.isNonceValid(jamOrder.taker, jamOrder.nonce)
    if (!isNonceValid){
      throw Error("Nonce is not valid")
    }
    // user cancels this limit order
    await fixture.settlement.connect(fixture.user).cancelOrder(jamOrder.nonce)
    try {
      // should fail because this limit order was cancelled
      await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
    } catch (e){
      isNonceValid = await fixture.settlement.isNonceValid(jamOrder.taker, jamOrder.nonce)
      if (isNonceValid){
        throw Error("Nonce is still valid after canceling the order")
      }
      return
    }
    throw Error("Error was expected")
  });

  //-----------------------------------------
  //
  //             PartialFill tests
  //
  // -----------------------------------------

  it('PartialFill simple', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let minFillPercent = 9000
    let curFillPercent = 9500
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, curFillPercent)
    await settle(
        jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers,null,
        true, false, false, [], curFillPercent
    )
  });

  it('PartialFill with Permits', async function () {
    let sellTokenTransfers: Commands[] = [
      //    DYDX (permit)   WETH(traded before with Permit2)   SNX (permit2)
      Commands.CALL_PERMIT_THEN_TRANSFER, Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER
    ]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let minFillPercent = 9000
    let curFillPercent = 9000
    let jamOrder: JamOrder.DataStruct = getOrder("Permits-fresh-mix", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker, curFillPercent)
    let permitsDeadline: number = Math.floor(Date.now() / 1000) + 10000
    let fullPermitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.user, [TOKENS.SNX], fixture.balanceManager.address, permitsDeadline
    )
    let extraPermitData: Signature.TakerPermitsInfoStruct = await signPermit(
        fixture.user, TOKENS.DYDX, fixture.balanceManager.address, permitsDeadline
    )
    fullPermitsData.permitSignatures = extraPermitData.permitSignatures
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, fullPermitsData,
        true, false, false, [], curFillPercent)
  });

  it('PartialFill with settleInternal', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let minFillPercent = 9000
    let curFillPercent = 9200
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true, [], curFillPercent)
  });

  it('PartialFill with settleInternal+increased amounts', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let minFillPercent = 9000
    let curFillPercent = 9000
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.directMaker.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
    let solverCalls: JamInteraction.DataStruct[] = []
    let increasedBuyAmounts: BigNumberish[] = [(Number(jamOrder.buyAmounts[0]) + 99999).toString()]
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, null, false, false, true, increasedBuyAmounts, curFillPercent)
  });


  it('PartialFill fail - invalid percent', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let minFillPercent = 9000
    let curFillPercent = 8999
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, fixture.solver.address, sellTokenTransfers, buyTokenTransfers, minFillPercent)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    try {
      await settle(
          jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers,null,
          true, false, false, [], curFillPercent
      )
    } catch (e){
        return
    }
    throw Error("Error was expected")
  });

  //-----------------------------------------
  //
  //               Batch tests
  //
  // -----------------------------------------

  it('settleBatch simple', async function () {
    let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
    let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
    let jamOrders: JamOrder.DataStruct[] = [
        getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
        getOrder("Simple", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [],
      takersPermitsUsage: [],
      transferExactAmounts: true
    }
    await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
        batchSellTokenTransfers, batchBuyTokenTransfers, [], solverData)
  });

  it('settleBatch same user', async function () {
    let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.PERMIT2_TRANSFER], [Commands.SIMPLE_TRANSFER]]
    let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
    let jamOrders: JamOrder.DataStruct[] = [
      getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
      getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
      getOrder("SimpleReverse", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[2], batchBuyTokenTransfers[2])!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[2], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [],
      takersPermitsUsage: [],
      transferExactAmounts: true
    }
    await batchSettle([fixture.user, fixture.user, fixture.anotherUser], jamOrders, allSolverCalls,
        batchSellTokenTransfers, batchBuyTokenTransfers, [], solverData)
  });

  it('settleBatch with permits', async function () {
    let batchSellTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.CALL_PERMIT2_THEN_TRANSFER], [Commands.CALL_PERMIT_THEN_TRANSFER]]
    let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER]]
    let jamOrders: JamOrder.DataStruct[] = [
      getOrder("Simple", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
      getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
      getOrder("UsingDaiPermit", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[2], batchBuyTokenTransfers[2])!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[2], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.user, jamOrders[1].sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )
    let permitsDataAnotherUser: Signature.TakerPermitsInfoStruct = await signPermit(
        fixture.anotherUser, TOKENS.DAI, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [],
      takersPermitsUsage: [false, true, true],
      transferExactAmounts: true
    }
    await batchSettle([fixture.user, fixture.user, fixture.anotherUser], jamOrders, allSolverCalls,
        batchSellTokenTransfers, batchBuyTokenTransfers, [permitsData, permitsDataAnotherUser], solverData)
  });

  it('settleBatch with excess', async function () {
    let batchSellTokenTransfers: Commands[][] = [
        [Commands.PERMIT2_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER, Commands.CALL_PERMIT2_THEN_TRANSFER],
        [Commands.CALL_PERMIT2_THEN_TRANSFER]
    ]
    let batchBuyTokenTransfers: Commands[][] = [[Commands.SIMPLE_TRANSFER], [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]]
    let jamOrders: JamOrder.DataStruct[] = [
      getOrder("Many-to-One", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
      getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    let permitsData: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.user, [TOKENS.LINK, TOKENS.WBTC], fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )
    let permitsDataAnotherUser: Signature.TakerPermitsInfoStruct = await signPermit2(
        fixture.anotherUser, jamOrders[1].sellTokens, fixture.balanceManager.address, Math.floor(Date.now() / 1000) + 10000
    )

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [],
      takersPermitsUsage: [true, true],
      transferExactAmounts: false
    }
    await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls, batchSellTokenTransfers,
        batchBuyTokenTransfers, [permitsData, permitsDataAnotherUser], solverData)
  });

  it('settleBatch with same tokens excess', async function () {
    let batchSellTokenTransfers: Commands[][] = [[Commands.PERMIT2_TRANSFER], [Commands.PERMIT2_TRANSFER]]
    let batchBuyTokenTransfers: Commands[][] = [
        [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER],
      [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    ]
    let jamOrders: JamOrder.DataStruct[] = [
      getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0])!,
      getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1])!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker)
    ]

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [],
      takersPermitsUsage: [],
      transferExactAmounts: false
    }
    await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
        batchSellTokenTransfers, batchBuyTokenTransfers,[], solverData)
  });

  it('settleBatch with partial fills', async function () {
    let batchSellTokenTransfers: Commands[][] = [[Commands.PERMIT2_TRANSFER], [Commands.PERMIT2_TRANSFER]]
    let batchBuyTokenTransfers: Commands[][] = [
      [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER],
      [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    ]
    let minFillPercent = 9000
    let jamOrders: JamOrder.DataStruct[] = [
      getOrder("One-to-Many-another", fixture.user.address, fixture.solver.address, batchSellTokenTransfers[0], batchBuyTokenTransfers[0], minFillPercent)!,
      getOrder("One-to-Many", fixture.anotherUser.address, fixture.solver.address, batchSellTokenTransfers[1], batchBuyTokenTransfers[1], minFillPercent)!,
    ]
    let allSolverCalls: JamInteraction.DataStruct[] = [
      ...await getBebopSolverCalls(jamOrders[0], bebop, fixture.solverContract.address, fixture.bebopMaker, minFillPercent),
      ...await getBebopSolverCalls(jamOrders[1], bebop, fixture.solverContract.address, fixture.bebopMaker, minFillPercent)
    ]

    let solverData: ExecInfo.BatchSolverDataStruct = {
      balanceRecipient: fixture.solverContract.address,
      curFillPercents: [minFillPercent, minFillPercent],
      takersPermitsUsage: [],
      transferExactAmounts: false
    }
    await batchSettle([fixture.user, fixture.anotherUser], jamOrders,allSolverCalls,
        batchSellTokenTransfers, batchBuyTokenTransfers,[], solverData, true)
  });




});
