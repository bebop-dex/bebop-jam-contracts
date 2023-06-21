import { expect } from "chai";
import { waffle } from "hardhat";
import { getFixture } from './fixture'
import BebopSettlement from './bebop/BebopSettlement.json'
import { Contract } from "ethers";
import { JamInteraction, JamOrder } from "../typechain-types/src/JamSettlement";

const AGGREGATE_ORDER_TYPES = {
  "AggregateOrder": [
      { "name": "expiry", "type": "uint256" },
      { "name": "taker_address", "type": "address" },
      { "name": "maker_addresses", "type": "address[]" },
      { "name": "maker_nonces", "type": "uint256[]" },
      { "name": "taker_tokens", "type": "address[][]" },
      { "name": "maker_tokens", "type": "address[][]" },
      { "name": "taker_amounts", "type": "uint256[][]" },
      { "name": "maker_amounts", "type": "uint256[][]" },
      { "name": "receivers", "type": "address[]" },
      { "name": "using_contract", "type": "bool[]"}
  ]
}

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

  it("Should deploy and add solver", async function () {
    const { registry, solver } = fixture;
    expect(await registry.isAllowed(solver.address))
  }); 

  it('Should swap with bebop settlement', async function () {
    const { token1, token2, token3, user, users, settlement, balanceManager, solver } = fixture;
    const maker = users[0]

    const jamOrder: JamOrder.DataStruct = {
      buyAmounts: [500000000],
      sellAmounts: [100000000, 200000000],
      expiry: Math.floor(Date.now() / 1000) + 100000,
      from: user.address,
      sellTokens: [token1.address, token2.address],
      buyTokens: [token3.address],
      receiver: user.address,
      signature: '0x' // TODO: Signature not validated atm 
    }

    await token1.mint(user.address, jamOrder.sellAmounts[0]);
    await token2.mint(user.address, jamOrder.sellAmounts[1]);
    await token3.mint(maker.address, jamOrder.buyAmounts[0]);

    await token1.connect(user).approve(balanceManager.address, jamOrder.sellAmounts[0]);
    await token2.connect(user).approve(balanceManager.address, jamOrder.sellAmounts[1]);
    await token3.connect(maker).approve(bebop.address, jamOrder.buyAmounts[0]);

    const maker_nonce = 100000000;
    const taker_address = settlement.address;
    const receiver = settlement.address;
    const maker_address = maker.address;
    const taker_tokens = jamOrder.sellTokens;
    const maker_tokens = jamOrder.buyTokens;
    const taker_amounts = jamOrder.sellAmounts;
    const maker_amounts = jamOrder.buyAmounts;
    const expiry = jamOrder.expiry;

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

    // Create the settlement transaction with Bebop PMM
    const settleTx = await bebop.connect(solver).populateTransaction.SettleAggregateOrder(aggregateOrder, { signatureType: 0, signatureBytes: '0x'}, [ { signatureBytesPermit2: '0x', signature: { signatureType: 0, signatureBytes: maker_sig } }])

    if (!settleTx.to || !settleTx.data) {
      throw new Error('Settle TX did not generate correctly')
    }

    const bebopApprovalTxToken1 = await token1.populateTransaction.approve(bebop.address, jamOrder.sellAmounts[0])
    const bebopApprovalTxToken2 = await token2.populateTransaction.approve(bebop.address, jamOrder.sellAmounts[1])

    if (!bebopApprovalTxToken1.to || !bebopApprovalTxToken1.data || !bebopApprovalTxToken2.to || !bebopApprovalTxToken2.data) {
      throw new Error('Approval TX did not generate correctly')
    }

    const interactions: JamInteraction.DataStruct[] = [
      // Approve BebopSettlement to transfer the sell token to maker
      { to: bebopApprovalTxToken1.to, data: bebopApprovalTxToken1.data, value: 0 },
      // Approve BebopSettlement to transfer the sell token to maker
      { to: bebopApprovalTxToken2.to, data: bebopApprovalTxToken2.data, value: 0 },
      // Call BebopSettlement to fill the order
      { to: settleTx.to, data: settleTx.data, value: 0 },
    ]

    await settlement.connect(solver).settle(jamOrder, interactions)

    const userBalance = await token3.balanceOf(jamOrder.receiver)

    expect(userBalance).to.be.equal(jamOrder.buyAmounts[0]);
  });
});
