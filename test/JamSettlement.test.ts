import { expect } from "chai";
import { waffle } from "hardhat";
import { getFixture } from './fixture'
import BebopSettlement from './bebop/BebopSettlement.json'
import { Contract, utils } from "ethers";
import { JamInteraction, JamOrder, JamHooks, Signature, JamSettlement } from "../typechain-types/src/JamSettlement";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const PARTIAL_ORDER_TYPES = {
  "PartialOrder": [
    { "name": "expiry", "type": "uint256" },
    { "name": "taker_address", "type": "address" },
    { "name": "maker_address", "type": "address" },
    { "name": "maker_nonce", "type": "uint256" },
    { "name": "taker_tokens", "type": "address[]" },
    { "name": "maker_tokens", "type": "address[]" },
    { "name": "taker_amounts", "type": "uint256[]" },
    { "name": "maker_amounts", "type": "uint256[]" },
    { "name": "receiver", "type": "address" },
  ]
}

const JAM_ORDER_TYPES = {
  "JamOrder": [
    { "name": "from", "type": "address" },
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

describe("JamSettlement", function () {
  let fixture: Awaited<ReturnType<typeof getFixture>>;
  let bebop: Contract;

  before(async () => {
    fixture = await getFixture();
    bebop = await waffle.deployContract(fixture.deployer, BebopSettlement, [
      '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      '0x000000000022d473030f116ddee9f6b43ac78ba3',
      '0x6b175474e89094c44da98b954eedeac495271d0f'
    ])
  });

  it('Should swap with bebop settlement', async function () {
    const { token1: sellToken1, token2: sellToken2, token3: buyToken, user, users, settlement, balanceManager, solver, solverContract } = fixture;
    const maker = users[0]

    const maker_nonce = 100000000;
    const taker_address = solverContract.address;
    const receiver = solverContract.address;
    const maker_address = maker.address;
    const taker_tokens = [sellToken1.address, sellToken2.address];
    const maker_tokens = [buyToken.address];
    const taker_amounts = [100000000, 200000000];
    const maker_amounts = [500000000];
    const expiry = Math.floor(Date.now() / 1000) + 100000;

    const BEBOP_DOMAIN = {
      "name": "BebopSettlement",
      "version": "1",
      "chainId": await user.getChainId(),
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
      "receiver": receiver
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
      "receivers": [receiver],
      "using_contract": [false]
    }

    await sellToken1.mint(user.address, taker_amounts[0]);
    await sellToken2.mint(user.address, taker_amounts[1]);
    await buyToken.mint(maker.address, maker_amounts[0]);

    await sellToken1.connect(user).approve(balanceManager.address, taker_amounts[0]);
    await sellToken2.connect(user).approve(balanceManager.address, taker_amounts[1]);
    await buyToken.connect(maker).approve(bebop.address, maker_amounts[0]);


    // Create the settlement transaction with Bebop PMM
    const settleTx = await bebop.connect(solver).populateTransaction.SettleAggregateOrder(aggregateOrder, { signatureType: 0, signatureBytes: '0x'}, [ { signatureBytesPermit2: '0x', signature: { signatureType: 0, signatureBytes: maker_sig } }])

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

    const hooks: JamHooks.DefStruct = {
      beforeSettle: [],
      afterSettle: []
    }
    const hooksEncoded = utils.defaultAbiCoder.encode(settlement.interface.getFunction("hashHooks").inputs, [hooks]);
    const hooksHash = utils.keccak256(hooksEncoded);

    // Deduct some coin as solver excess
    const solverExcess = 1000
    const buyAmount = partialOrder.maker_amounts[0] - solverExcess

    const jamOrder: JamOrder.DataStruct = {
      buyAmounts: [buyAmount],
      sellAmounts: taker_amounts,
      expiry,
      from: user.address,
      sellTokens: taker_tokens,
      buyTokens: maker_tokens,
      receiver: user.address,
      nonce: 123,
      hooksHash: hooksHash,
    }

    const transferToSolverToken1 = await sellToken1.populateTransaction.transfer(solverContract.address, jamOrder.sellAmounts[0])
    const transferToSolverToken2 = await sellToken2.populateTransaction.transfer(solverContract.address, jamOrder.sellAmounts[1])

    const executeOnSolverContract = await solverContract.populateTransaction.execute(solverCalls, jamOrder.buyTokens, jamOrder.buyAmounts, settlement.address);

    const interactions: JamInteraction.DataStruct[] = [
      // Transfer sell token 1 to solver contract
      { result: true, to: transferToSolverToken1.to!, data: transferToSolverToken1.data!, value: 0 },
      // Transfer sell token 2 to solver contract
      { result: true, to: transferToSolverToken2.to!, data: transferToSolverToken2.data!, value: 0 },
      // Call execute on solver contract
      { result: true, to: executeOnSolverContract.to!, data: executeOnSolverContract.data!, value: 0}
    ]

    const signature = await signJamOrder(user, jamOrder, settlement);

    await settlement.connect(solver).settle(jamOrder, signature, interactions, hooks);

    const userBalance = await buyToken.balanceOf(jamOrder.receiver);
    const solverContractBalance = await buyToken.balanceOf(solverContract.address);

    expect(userBalance).to.be.equal(jamOrder.buyAmounts[0]);
    expect(solverContractBalance).to.be.equal(solverExcess);
  });
});
