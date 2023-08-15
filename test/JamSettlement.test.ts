import {waffle} from "hardhat";
import {getFixture} from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, utils} from "ethers";
import {JamHooks, JamInteraction, JamOrder, JamSettlement} from "../typechain-types/artifacts/src/JamSettlement";
import {BebopSettlement} from "../typechain-types";
import {PERMIT2_ADDRESS, TOKENS} from "./config";
import {
  approveTokens,
  getBalancesBefore,
  signJamOrder,
  verifyBalancesAfter
} from "./utils/utils";
import {Commands, getOrder} from "./utils/orders";
import {getBebopSolverCalls} from "./bebop/bebop-utils";
import {HooksGenerator} from "./hooks/hooksGenerator";


describe("JamSettlement", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let hooksGenerator: HooksGenerator;

  let emptyHooks: JamHooks.DefStruct = {
    beforeSettle: [],
    afterSettle: []
  }

  async function settle(
      jamOrder: JamOrder.DataStruct,
      balanceRecipient: string,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[],
      sellTokensTransfers: Commands[],
      buyTokensTransfers: Commands[],
      usingSolverContract: boolean = true,
      skipTakerApprovals: boolean = false,
      directSettle: boolean = false
  ) {
    const { user, settlement, solver, solverContract, directMaker } = fixture;

    // Approving takers tokens
    let nativeTokenAmount = BigNumber.from(0)
    if (!skipTakerApprovals) {
      nativeTokenAmount = await approveTokens(jamOrder.sellTokens, jamOrder.sellAmounts, sellTokensTransfers, user, fixture.balanceManager.address);
    }

    let interactions: JamInteraction.DataStruct[];
    let executor = solver;
    let solverExcess = 1000
    if (usingSolverContract) {
      let executeOnSolverContract = await solverContract.populateTransaction.execute(
          solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, jamOrder.buyNFTIds, jamOrder.buyTokenTransfers, settlement.address
      );
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
        jamOrder.buyTokens, jamOrder.receiver, buyTokensTransfers, jamOrder.buyNFTIds, solverContract.address)

    if (directSettle) {
      nativeTokenAmount = await approveTokens(jamOrder.buyTokens, jamOrder.buyAmounts, buyTokensTransfers, directMaker, fixture.balanceManager.address)
      await settlement.connect(directMaker).settleInternal(jamOrder, signature, hooks, {value: nativeTokenAmount.toString()});
    } else {
      await settlement.connect(executor).settle(jamOrder, signature, interactions, hooks, balanceRecipient, {value: nativeTokenAmount.toString()});
    }

    await verifyBalancesAfter(jamOrder.buyTokens, jamOrder.receiver, sellTokensTransfers, buyTokensTransfers, jamOrder.buyNFTIds, solverContract.address,
        usingSolverContract, jamOrder.buyAmounts, solverExcess, userBalancesBefore, solverBalancesBefore, directSettle)
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
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Many-to-one', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Many-to-One", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('One-to-Many', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("One-to-Many", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Many-to-Many', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER, Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Many-to-Many", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
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
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, true, true)
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
    await settle(jamOrder, fixture.solverContract.address, hooks, solverCalls, sellTokenTransfers, buyTokenTransfers, true, true)
  });

  it('Taker execution with Native token', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellNative", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.settlement.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers, false)
  });

  it('Native token transfer to taker', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyNative", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Buy NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC721", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Buy NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC1155", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Sell NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC721", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('Sell NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC1155", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('settleInternal', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });

  it('settleInternal Buy NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC721-Repeated", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });

  it('settleInternal Buy NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("BuyERC1155-Repeated", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });

  it('settleInternal Sell NFT ERC721', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC721-Repeated", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });

  it('settleInternal Sell NFT ERC1155', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.SIMPLE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("SellERC1155-Repeated", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });

  it('NFT-to-NFT', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFT-to-NFT", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('NFTs-to-NFTs', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER, Commands.NFT_ERC1155_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NFT_ERC1155_TRANSFER, Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFTs-to-NFTs", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, fixture.solverContract.address, emptyHooks, solverCalls, sellTokenTransfers, buyTokenTransfers)
  });

  it('NFT-to-NFT+ETH', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NFT_ERC721_TRANSFER]
    let buyTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER, Commands.NFT_ERC721_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("NFT-to-NFT+ETH", fixture.user.address, sellTokenTransfers, buyTokenTransfers)!
    let solverCalls: JamInteraction.DataStruct[] = []
    await settle(jamOrder, "0x", emptyHooks, solverCalls, sellTokenTransfers,
        buyTokenTransfers, false, false, true)
  });


});
