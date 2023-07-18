import {JamInteraction} from "../../typechain-types/artifacts/src/JamSettlement";
import {JamOrder} from "../../typechain-types/artifacts/src/JamSigning";
import {BebopSettlement, JamSolver} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers, network} from "hardhat";
import {BigNumber} from "ethers";


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

export async function getBebopSolverCalls(
    jamOrder: JamOrder.DataStruct,
    bebop: BebopSettlement,
    solverContract: JamSolver,
    maker: SignerWithAddress,
){
    const maker_nonce = Math.floor(Math.random() * 1000000);
    const taker_address = solverContract.address;
    const receiver = solverContract.address;
    const maker_address = maker.address;
    const taker_tokens = jamOrder.sellTokens;
    const maker_tokens = jamOrder.buyTokens;
    const taker_amounts = jamOrder.sellAmounts;
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const solverExcess = 1000;
    let maker_amounts = []
    for (let i = 0; i < maker_tokens.length; i++){
        maker_amounts.push(BigNumber.from(jamOrder.buyAmounts[i]).add(solverExcess).toString());
    }

    const BEBOP_DOMAIN = {
        "name": "BebopSettlement",
        "version": "1",
        "chainId": network.config.chainId,
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
        "commands": "0x" + "00".repeat(taker_tokens.length + maker_tokens.length)
    }
    const maker_sig = await maker._signTypedData(BEBOP_DOMAIN, PARTIAL_ORDER_TYPES, partialOrder)
    for (let i = 0; i < maker_tokens.length; i++){
        let tokenContract = await ethers.getContractAt("ERC20", maker_tokens[i])
        await tokenContract.connect(maker).approve(bebop.address, maker_tokens[i])
    }


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
        "commands": "0x" + "00".repeat(taker_tokens.length + maker_tokens.length)
    }

    const settleTx = await bebop.populateTransaction.SettleAggregateOrder(
        aggregateOrder,
        { signatureType: 0, signatureBytes: '0x'},
        [ {  signature: { signatureType: 0, signatureBytes: maker_sig }, usingPermit2: false }]
    )

    let solverCalls: JamInteraction.DataStruct[] = []
    for (let i = 0; i < taker_tokens.length; i++){
        let tokenContract = await ethers.getContractAt("ERC20", taker_tokens[i])
        const bebopApprovalTxToken = await tokenContract.populateTransaction.approve(bebop.address, taker_amounts[i])
        solverCalls.push({ result: true, to: bebopApprovalTxToken.to!, data: bebopApprovalTxToken.data!, value: 0 })
    }

    solverCalls.push({ result: true, to: settleTx.to!, data: settleTx.data!, value: 0 })
    return solverCalls
}