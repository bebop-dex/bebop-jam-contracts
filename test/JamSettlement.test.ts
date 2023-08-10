import {ethers, waffle} from "hardhat";
import {getFixture} from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, utils} from "ethers";
import {
  JamHooks,
  JamInteraction,
  JamOrder,
  JamSettlement
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
      balanceRecipient: string,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[],
      sellTokensTransfers: Commands[],
      buyTokensTransfers: Commands[],
      solverContractType: SolverContractType = SolverContractType.ERC20,
      skipTakerApprovals: boolean = false
  ) {
    const { user, settlement, solver, solverContract } = fixture;

    // Approving takers tokens
    let nativeTokenAmount = BigNumber.from(0)
    if (!skipTakerApprovals) {
      for (let i = 0; i < jamOrder.sellTokens.length; i++) {
        let curTokenContract = await ethers.getContractAt("ERC20", jamOrder.sellTokens[i])
        if (sellTokensTransfers[i] === Commands.SIMPLE_TRANSFER) {
          await curTokenContract.connect(fixture.user).approve(fixture.balanceManager.address, jamOrder.sellAmounts[i]);
        } else if (sellTokensTransfers[i] === Commands.PERMIT2_TRANSFER) {
          await curTokenContract.connect(fixture.user).approve(PERMIT2_ADDRESS, jamOrder.sellAmounts[i]);
        } else if (sellTokensTransfers[i] === Commands.NATIVE_TRANSFER) {
          nativeTokenAmount = nativeTokenAmount.add(BigNumber.from(jamOrder.sellAmounts[i]))
        } else if (sellTokensTransfers[i] === Commands.NFT_ERC721_TRANSFER) {
          let nftTokenContract = await ethers.getContractAt("IERC721", jamOrder.sellTokens[i])
          await nftTokenContract.connect(fixture.user).setApprovalForAll(fixture.balanceManager.address, true);
        } else if (sellTokensTransfers[i] === Commands.NFT_ERC1155_TRANSFER) {
          let nftTokenContract = await ethers.getContractAt("IERC1155", jamOrder.sellTokens[i])
          await nftTokenContract.connect(fixture.user).setApprovalForAll(fixture.balanceManager.address, true);
        }
      }
    }

    let interactions: JamInteraction.DataStruct[];
    let executor = solver;
    let solverExcess = 1000
    if (solverContractType != SolverContractType.NONE) {
      let executeOnSolverContract;
      if (solverContractType === SolverContractType.ERC20) {
        executeOnSolverContract = await solverContract.populateTransaction.execute(
            solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, jamOrder.receiver
        );
      } else if (solverContractType === SolverContractType.ERC721){
        executeOnSolverContract = await solverContract.populateTransaction.executeWithERC721(
            solverCalls, jamOrder.buyTokens, jamOrder.buyNFTIds, jamOrder.receiver
        );
      } else {
        executeOnSolverContract = await solverContract.populateTransaction.executeWithERC1155(
            solverCalls, jamOrder.buyTokens, jamOrder.buyNFTIds, jamOrder.buyAmounts, jamOrder.receiver
        );
      }
      interactions = [
        { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: nativeTokenAmount.toString() }
      ]
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

    await settlement.connect(executor).settle(jamOrder, signature, interactions, hooks, balanceRecipient, {value: nativeTokenAmount.toString()});

    await verifyBalancesAfter(jamOrder.buyTokens, jamOrder.receiver, sellTokensTransfers, buyTokensTransfers, solverContract.address,
        solverContractType, jamOrder.buyAmounts, solverExcess, userBalancesBefore, solverBalancesBefore)
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
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Permit2 hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit2 = await hooksGenerator.getHook_Permit2(jamOrder.sellTokens, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Permit hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SimpleReverse", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit.to!, data: takerPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC20, true)
  });

  it('DAI-Permit hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("UsingDaiPermit", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const daiPermit = await hooksGenerator.getHook_Permit(jamOrder.sellTokens[0], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: daiPermit.to!, data: daiPermit.data!, value: 0 }],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC20, true)
  });

  it('Taker execution with Native token', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellNative", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker, fixture.user.address)

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    await settle(jamOrder, fixture.settlement.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.NONE)
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
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
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
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC721)
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
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC1155)
  });

  it('Sell NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC721", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC20)
  });

  it('Sell NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC1155", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, SolverContractType.ERC20)
  });

});
