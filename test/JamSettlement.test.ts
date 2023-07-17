import { expect } from "chai";
import { waffle } from "hardhat";
import { getFixture } from './fixture'
import BebopSettlementABI from './bebop/BebopSettlement.json'
import {BigNumber, utils} from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {AllowanceTransfer, MaxUint160, MaxUint256} from "@uniswap/permit2-sdk";
import {PermitBatch, PermitDetails} from "@uniswap/permit2-sdk/dist/allowanceTransfer";
import {JamInteraction, JamOrder, JamHooks, Signature, JamSettlement, JamTransfer} from "../typechain-types/artifacts/src/JamSettlement";
import {BebopSettlement, Permit2, Permit2__factory} from "../typechain-types";

const PARTIAL_ORDER_TYPES = {
  "Partial": [
    { "name": "expiry", "type": "uint256" },
    { "name": "taker_address", "type": "address" },
    { "name": "maker_address", "type": "address" },
    { "name": "maker_nonce", "type": "uint256" },
    { "name": "taker_tokens", "type": "address[]" },
    { "name": "maker_tokens", "type": "address[]" },
    { "name": "taker_amounts", "type": "uint256[]" },
    { "name": "maker_amounts", "type": "uint256[]" },
    { "name": "receiver", "type": "address" },
    { "name": "commands", "type": "bytes" }
  ]
}

const JAM_ORDER_TYPES = {
  "JamOrder": [
    { "name": "taker", "type": "address" },
    { "name": "receiver", "type": "address" },
    { "name": "expiry", "type": "uint32" },
    { "name": "nonce", "type": "uint256" },
    { "name": "hooksHash", "type": "bytes32" },
    { "name": "buyTokens", "type": "address[]" },
    { "name": "sellTokens", "type": "address[]" },
    { "name": "buyAmounts", "type": "uint256[]" },
    { "name": "sellAmounts", "type": "uint256[]" },
  ]
}

async function signJamOrder(user: SignerWithAddress, order: JamOrder.DataStruct, settlement: JamSettlement) {
  const JAM_DOMAIN = {
    "name": "JamSettlement",
    "version": "1",
    "chainId": await user.getChainId(),
    "verifyingContract": settlement.address
  }

  const signatureBytes = await user._signTypedData(JAM_DOMAIN, JAM_ORDER_TYPES, order);
  const signature: Signature.TypedSignatureStruct = {
    signatureType: 1,
    signatureBytes: signatureBytes
  }

  return signature
}

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
  return await  permit2Contract.populateTransaction["permit(address,((address,uint160,uint48,uint48)[],address,uint256),bytes)"](user.address, msgPermit2, signature);
}

describe("JamSettlement", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: BebopSettlement;
  let permit2Contract: Permit2;

  async function bebopSettlement(hooks: JamHooks.DefStruct, needTakerApproval: boolean = true) {
    const { token1: sellToken1, token2: sellToken2, token3: buyToken, user, users, settlement, balanceManager, solver, solverContract } = fixture;
    const maker = users[0]

    const maker_nonce = Math.floor(Math.random() * 1000000);
    const taker_address = solverContract.address;
    const receiver = solverContract.address;
    const maker_address = maker.address;
    const taker_tokens = [sellToken1.address, sellToken2.address];
    const maker_tokens = [buyToken.address];
    const taker_amounts = [100000000, 200000000];
    const maker_amounts = [500000000];
    const expiry = Math.floor(Date.now() / 1000) + 1000;

    const BEBOP_DOMAIN = {
      "name": "BebopSettlement",
      "version": "1",
      "chainId": (await user.getChainId()),
      "verifyingContract": bebop.address
    }

    const partialOrder = {
      "expiry": expiry,
      "taker_address": taker_address,
      "maker_address": maker_address,
      "maker_nonce": maker_nonce,
      "taker_tokens": taker_tokens,
      "maker_tokens": maker_tokens,
      "taker_amounts": taker_amounts,
      "maker_amounts": maker_amounts,
      "receiver": receiver,
      "commands": "0x000000"
    }

    const maker_sig = await maker._signTypedData(BEBOP_DOMAIN, PARTIAL_ORDER_TYPES, partialOrder)

    const aggregateOrder = {
      "expiry": expiry,
      "taker_address": taker_address,
      "maker_addresses": [maker_address],
      "maker_nonces": [maker_nonce],
      "taker_tokens": [taker_tokens],
      "maker_tokens": [maker_tokens],
      "taker_amounts": [taker_amounts],
      "maker_amounts": [maker_amounts],
      "receiver": receiver,
      "commands": "0x000000"
    }

    await sellToken1.mint(user.address, taker_amounts[0]);
    await sellToken2.mint(user.address, taker_amounts[1]);
    await buyToken.mint(maker.address, maker_amounts[0]);

    if (needTakerApproval) {
      await sellToken1.connect(user).approve(balanceManager.address, taker_amounts[0]);
      await sellToken2.connect(user).approve(balanceManager.address, taker_amounts[1]);
    }
    await buyToken.connect(maker).approve(bebop.address, maker_amounts[0]);


    // Create the settlement transaction with Bebop PMM
    const settleTx = await bebop.populateTransaction.SettleAggregateOrder(aggregateOrder, { signatureType: 0, signatureBytes: '0x'}, [ {  signature: { signatureType: 0, signatureBytes: maker_sig }, usingPermit2: false }])

    const bebopApprovalTxToken1 = await sellToken1.populateTransaction.approve(bebop.address, taker_amounts[0])
    const bebopApprovalTxToken2 = await sellToken2.populateTransaction.approve(bebop.address, taker_amounts[1])

    const solverCalls: JamInteraction.DataStruct[] = [
      // Approve BebopSettlement to transfer the sell token to maker
      { result: true, to: bebopApprovalTxToken1.to!, data: bebopApprovalTxToken1.data!, value: 0 },
      // Approve BebopSettlement to transfer the sell token to maker
      { result: true, to: bebopApprovalTxToken2.to!, data: bebopApprovalTxToken2.data!, value: 0 },
      // Call BebopSettlement to fill the order
      { result: true, to: settleTx.to!, data: settleTx.data!, value: 0 },
    ]

    // Deduct some coin as solver excess
    const solverExcess = 1000
    const buyAmount = partialOrder.maker_amounts[0] - solverExcess

    const hooksEncoded = utils.defaultAbiCoder.encode(fixture.settlement.interface.getFunction("hashHooks").inputs, [hooks]);
    const hooksHash = utils.keccak256(hooksEncoded);

    const jamOrder: JamOrder.DataStruct = {
      buyAmounts: [buyAmount],
      sellAmounts: taker_amounts,
      expiry,
      taker: user.address,
      sellTokens: taker_tokens,
      buyTokens: maker_tokens,
      receiver: user.address,
      nonce: Math.floor(Math.random() * 1000000),
      hooksHash: hooksHash,
    }

    let initTransfer: JamTransfer.InitialStruct = {
      balanceRecipient: solverContract.address,
      usingPermit2: !needTakerApproval
    }

    const executeOnSolverContract = await solverContract.populateTransaction.execute(solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, settlement.address);

    const interactions: JamInteraction.DataStruct[] = [
      // Call execute on solver contract
      { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: 0}
    ]

    const signature = await signJamOrder(user, jamOrder, settlement);

    const userBalanceBefore: BigNumber = await buyToken.balanceOf(jamOrder.receiver);
    const solverBalanceBefore: BigNumber = await buyToken.balanceOf(solverContract.address);

    await settlement.connect(solver).settle(jamOrder, signature, interactions, hooks, initTransfer);

    const userBalanceAfter: BigNumber = await buyToken.balanceOf(jamOrder.receiver);
    const solverBalanceAfter: BigNumber = await buyToken.balanceOf(solverContract.address);

    expect(userBalanceAfter.sub(userBalanceBefore).toString()).to.be.equal(jamOrder.buyAmounts[0].toString());
    expect(solverBalanceAfter.sub(solverBalanceBefore).toString()).to.be.equal(solverExcess.toString());
  }

  before(async () => {
    fixture = await getFixture();
    bebop = await waffle.deployContract(fixture.deployer, BebopSettlementABI, [
      '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      '0x000000000022d473030f116ddee9f6b43ac78ba3',
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    ]) as BebopSettlement;
    permit2Contract = Permit2__factory.connect('0x000000000022d473030f116ddee9f6b43ac78ba3', fixture.deployer)
  });

  it('Should swap with bebop settlement', async function () {
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    await bebopSettlement(hooks)
  });

  it('Should swap with bebop settlement + Permit2 hooks', async function () {
    await fixture.token1.connect(fixture.user).approve(permit2Contract.address, MaxUint256);
    await fixture.token2.connect(fixture.user).approve(permit2Contract.address, MaxUint256);
    const takerPermit2 = await getPermit2Tx(fixture.user, permit2Contract,
        [fixture.token1.address, fixture.token2.address], fixture.balanceManager.address);
    const hooks: JamHooks.DefStruct = {
      beforeSettle: [
          { result: true, to: takerPermit2.to!, data: takerPermit2.data!, value: 0 },
      ],
      afterSettle: []
    }
    await bebopSettlement(hooks, false)
  });
});
