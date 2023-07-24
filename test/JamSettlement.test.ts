import {expect} from "chai";
import {ethers, waffle} from "hardhat";
import {getFixture} from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, BigNumberish, utils} from "ethers";
import {
  JamHooks,
  JamInteraction,
  JamOrder,
  JamSettlement,
  JamTransfer
} from "../typechain-types/artifacts/src/JamSettlement";
import {BebopSettlement} from "../typechain-types";
import {PERMIT2_ADDRESS, TOKENS} from "./config";
import {signJamOrder} from "./utils/utils";
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
      usingSolverContract: boolean = true,
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
    if (usingSolverContract) {
      const executeOnSolverContract = await solverContract.populateTransaction.execute(
          solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, settlement.address
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

    let userBalancesBefore: {[id:string]: BigNumberish} = {}
    let solverBalancesBefore: {[id:string]: BigNumberish} = {}
    for (let token of jamOrder.buyTokens) {
      userBalancesBefore[token] = await (await ethers.getContractAt("ERC20", token)).balanceOf(jamOrder.receiver)
      solverBalancesBefore[token] = await (await ethers.getContractAt("ERC20", token)).balanceOf(solverContract.address)
    }

    await settlement.connect(executor).settle(jamOrder, signature, interactions, hooks, initTransfer, {value: nativeTokenAmount.toString()});

    for (let i = 0; i < jamOrder.buyTokens.length; i++) {
      let userBalanceAfter = await (await ethers.getContractAt("ERC20", jamOrder.buyTokens[i])).balanceOf(jamOrder.receiver)
      expect(userBalanceAfter.sub(userBalancesBefore[jamOrder.buyTokens[i]])).to.be.equal(BigNumber.from(jamOrder.buyAmounts[i]).add(usingSolverContract ? 0:solverExcess))
      let solverBalanceAfter = await (await ethers.getContractAt("ERC20", jamOrder.buyTokens[i])).balanceOf(solverContract.address)
      expect(solverBalanceAfter.sub(solverBalancesBefore[jamOrder.buyTokens[i]])).to.be.equal(usingSolverContract ? solverExcess:0) // solver excess
    }
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
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers)
  });

  it('Should swap with bebop settlement + Permit2 hooks', async function () {
    let sellTokenTransfers: Commands[] = [Commands.PERMIT2_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract.address, fixture.bebopMaker)

    const takerPermit2 = await hooksGenerator.getHook_Permit2(jamOrder.sellTokens, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 }],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers)
  });

  it('Taker execution with Native token', async function () {
    let sellTokenTransfers: Commands[] = [Commands.NATIVE_TRANSFER]
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address, sellTokenTransfers)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.settlement.address, fixture.bebopMaker)

    const wrapTakerNative = await hooksGenerator.getHook_wrapNative(jamOrder.sellAmounts[0]);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: wrapTakerNative.to!, data: wrapTakerNative.data!, value: wrapTakerNative.value!}],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.settlement.address,
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls, sellTokenTransfers, false)
  });
});
