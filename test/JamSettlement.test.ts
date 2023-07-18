import { expect } from "chai";
import {ethers, waffle} from "hardhat";
import { getFixture } from './utils/fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumberish, utils} from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {AllowanceTransfer, MaxUint160, MaxUint256} from "@uniswap/permit2-sdk";
import {PermitBatch, PermitDetails} from "@uniswap/permit2-sdk/dist/allowanceTransfer";
import {JamInteraction, JamOrder, JamHooks, JamSettlement, JamTransfer} from "../typechain-types/artifacts/src/JamSettlement";
import {BebopSettlement, Permit2, Permit2__factory} from "../typechain-types";
import {PERMIT2_ADDRESS, TOKENS} from "./config";
import {signJamOrder} from "./utils/utils";
import {getOrder} from "./utils/orders";
import {getBebopSolverCalls} from "./bebop/bebop-utils";



async function getPermit2Tx(user: SignerWithAddress, permit2Contract: Permit2, tokenAddresses: string[], spender: string){
  let deadline = (Math.round(Date.now() / 1000) + 12000).toString()
  let tokenDetails: PermitDetails[] = []
  for (let i = 0; i < tokenAddresses.length; i++) {
    tokenDetails.push({
      token: tokenAddresses[i],
      amount: MaxUint160,
      expiration: deadline,
      nonce: (await permit2Contract.allowance(user.address, tokenAddresses[i], spender)).nonce
    })
  }

  let msgPermit2: PermitBatch = {
    details: tokenDetails,
    spender: spender,
    sigDeadline: deadline
  }
  let permitMsgTyped = AllowanceTransfer.getPermitData(msgPermit2, permit2Contract.address, await user.getChainId())
  const { domain, types, values } = permitMsgTyped
  let signature = await user._signTypedData(domain, types, values)
  return await permit2Contract.populateTransaction["permit(address,((address,uint160,uint48,uint48)[],address,uint256),bytes)"](user.address, msgPermit2, signature);
}

describe("JamSettlement", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let permit2Contract: Permit2;

  async function settle(
      jamOrder: JamOrder.DataStruct,
      initTransfer: JamTransfer.InitialStruct,
      hooks: JamHooks.DefStruct,
      solverCalls: JamInteraction.DataStruct[]
  ) {
    const { user, settlement, solver, solverContract } = fixture;

    for (let i = 0; i < jamOrder.sellTokens.length; i++) {
      let curTokenContract = await ethers.getContractAt("ERC20", jamOrder.sellTokens[i])
      if (initTransfer.usingPermit2){
        await curTokenContract.connect(fixture.user).approve(permit2Contract.address, jamOrder.sellAmounts[i]);
      } else {
        // Approve user tokens to JamBalanceManager
        await curTokenContract.connect(fixture.user).approve(fixture.balanceManager.address, jamOrder.sellAmounts[i]);
      }
    }

    const executeOnSolverContract = await solverContract.populateTransaction.execute(
        solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, settlement.address
    );
    const interactions: JamInteraction.DataStruct[] = [
      // Call execute on solver contract
      { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: 0}
    ]

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

    await settlement.connect(solver).settle(jamOrder, signature, interactions, hooks, initTransfer);

    for (let i = 0; i < jamOrder.buyTokens.length; i++) {
      let userBalanceAfter = await (await ethers.getContractAt("ERC20", jamOrder.buyTokens[i])).balanceOf(jamOrder.receiver)
      let solverBalanceAfter = await (await ethers.getContractAt("ERC20", jamOrder.buyTokens[i])).balanceOf(solverContract.address)
      expect(userBalanceAfter.sub(userBalancesBefore[jamOrder.buyTokens[i]])).to.be.equal(jamOrder.buyAmounts[i])
      expect(solverBalanceAfter.sub(solverBalancesBefore[jamOrder.buyTokens[i]])).to.be.equal(1000) // solver excess
    }
  }

  before(async () => {
    fixture = await getFixture();
    bebop = await waffle.deployContract(fixture.deployer, BebopSettlementABI, [
      TOKENS.WETH,
      PERMIT2_ADDRESS,
      TOKENS.USDC
    ]) as BebopSettlement;
    permit2Contract = Permit2__factory.connect(PERMIT2_ADDRESS, fixture.deployer)
  });

  it('Simple BebopSettlement', async function () {
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract, fixture.bebopMaker)
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
      usingPermit2: false
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls)
  });

  it('Should swap with bebop settlement + Permit2 hooks', async function () {
    let jamOrder: JamOrder.DataStruct = getOrder("Simple", fixture.user.address)!
    let solverCalls = await getBebopSolverCalls(jamOrder, bebop, fixture.solverContract, fixture.bebopMaker)

    const takerPermit2 = await getPermit2Tx(fixture.user, permit2Contract,
        jamOrder.sellTokens, fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [{ result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 },],
      afterSettle: []
    }
    let initialTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: fixture.solverContract.address,
      usingPermit2: false
    }
    await settle(jamOrder, initialTransfer, hooks, solverCalls)
  });
});
