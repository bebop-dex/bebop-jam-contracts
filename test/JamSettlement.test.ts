import {ethers, waffle} from "hardhat";
import {getFixture} from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, utils} from "ethers";
import {
  JamHooks,
  JamInteraction,
  JamOrder,
  JamSettlement,
  JamTransfer
} from "../typechain-types/artifacts/src/JamSettlement";
import {BebopSettlement} from "../typechain-types";
import {PERMIT2_ADDRESS, TOKENS} from "./config";
import {getBalancesBefore, signJamOrder, SolverContractType, verifyBalancesAfter} from "./utils/utils";
import {Commands, getOrder} from "./utils/orders";
import {getBebopSolverCalls} from "./bebop/bebop-utils";
import {HooksGenerator} from "./hooks/hooksGenerator";


describe("JamSettlement", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let hooksGenerator: HooksGenerator;

  async function settle(
      jamOrder: JamOrder.DataStruct,
      initTransfer: JamTransfer.InitialStruct,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[],
      sellTokensTransfers: Commands[],
      buyTokensTransfers: Commands[],
      solverContractType: SolverContractType = SolverContractType.ERC20
  ) {
    const { user, settlement, solver, solverContract } = fixture;

    // Approving takers tokens
    let nativeTokenAmount = BigNumber.from(0)
    for (let i = 0; i < jamOrder.sellTokens.length; i++) {
      let curTokenContract = await ethers.getContractAt("ERC20", jamOrder.sellTokens[i])
      if (sellTokensTransfers[i] === Commands.SIMPLE_TRANSFER) {
        await curTokenContract.connect(fixture.user).approve(fixture.balanceManager.address, jamOrder.sellAmounts[i]);
      } else if (sellTokensTransfers[i] === Commands.PERMIT2_TRANSFER){
        await curTokenContract.connect(fixture.user).approve(PERMIT2_ADDRESS, jamOrder.sellAmounts[i]);
      } else if (sellTokensTransfers[i] === Commands.NATIVE_TRANSFER) {
        nativeTokenAmount = nativeTokenAmount.add(BigNumber.from(jamOrder.sellAmounts[i]))
      }
    }

    let interactions: JamInteraction.DataStruct[];
    let executor = solver;
    let solverExcess = 1000
    if (solverContractType != SolverContractType.NONE) {
      let executeOnSolverContract;
      if (solverContractType === SolverContractType.ERC20) {
        executeOnSolverContract = await solverContract.populateTransaction.execute(
            solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, settlement.address
        );
      } else if (solverContractType === SolverContractType.ERC721){
        executeOnSolverContract = await solverContract.populateTransaction.executeWithERC721(
            solverCalls, jamOrder.buyTokens, jamOrder.buyNFTIds, settlement.address
        );
      } else {
        executeOnSolverContract = await solverContract.populateTransaction.executeWithERC1155(
            solverCalls, jamOrder.buyTokens, jamOrder.buyNFTIds, jamOrder.buyAmounts, settlement.address
        );
      }
      interactions = [
        { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: nativeTokenAmount.toString() }
      ]
      for (let [i, command] of buyTokensTransfers.entries()) {
        if (command === Commands.NATIVE_TRANSFER) {
          const unwrapMakerToken = await hooksGenerator.getHook_unwrap(jamOrder.buyAmounts[i]);
          interactions.push({result: true, to: unwrapMakerToken.to!, data: unwrapMakerToken.data!, value: '0'})
        }
      }
    } else {
      executor = user
      interactions = solverCalls
    }

    jamOrder.hooksHash = utils.keccak256(
        utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks])
    )
    const signature = await signJamOrder(user, jamOrder, settlement);

    let [userBalancesBefore, solverBalancesBefore] = await getBalancesBefore(
        jamOrder.buyTokens, jamOrder.receiver, buyTokensTransfers, solverContract.address, solverContractType)

    await settlement.connect(executor).settle(jamOrder, signature, interactions, hooks, initTransfer, {value: nativeTokenAmount.toString()});

    await verifyBalancesAfter(jamOrder.buyTokens, jamOrder.receiver, buyTokensTransfers, solverContract.address,
        solverContractType, jamOrder.buyAmounts, solverExcess, userBalancesBefore, solverBalancesBefore)
  }

  before(async () => {
    fixture = await getFixture();
    bebop = await waffle.deployContract(fixture.deployer, BebopSettlementABI, [
      TOKENS.WETH,
      PERMIT2_ADDRESS,
      TOKENS.USDC
    ]) as BebopSettlement;
    hooksGenerator = new HooksGenerator(fixture.user)
  });

  it('Simple BebopSettlement', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Should swap with bebop settlement + Permit2 hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit2 = await hooksGenerator.getHook_Permit2(jamOrder.sellTokens, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 }],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Taker execution with Native token', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)

    const wrapTakerNative = await hooksGenerator.getHook_wrapNative(jamOrder.sellAmounts[0]);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: wrapTakerNative.to!, data: wrapTakerNative.data!, value: wrapTakerNative.value!}],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.settlement.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.NONE)
  });

  it('Native token transfer to taker', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Unwrap and native transfer', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.UNWRAP_AND_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Buy NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC721", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC721)
  });

  it('Buy NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC1155", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC1155)
  });
});
