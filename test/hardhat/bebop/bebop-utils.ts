import {JamInteraction, JamOrder} from "../../../typechain-types/artifacts/src/JamSettlement";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers, network} from "hardhat";
import {BigNumber} from "ethers";
import {TOKENS} from "../config";
import {BebopSettlement} from "../../../typechain-types";


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
    takerAddress: string,
    maker: SignerWithAddress,
    curFillPercent: number = 10000
): Promise<JamInteraction.DataStruct[]> {
    const maker_nonce = Math.floor(Math.random() * 1000000);
    const taker_address = takerAddress;
    const receiver = takerAddress;
    const maker_address = maker.address;
    const taker_amounts = [];
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const solverExcess = 1000;
    let maker_amounts = []
    let taker_tokens = [];
    let maker_tokens = [];
    let commands = "0x"
    for (let i = 0; i < jamOrder.buyTokens.length; i++){
        maker_amounts.push(BigNumber.from(jamOrder.buyAmounts[i]).mul(curFillPercent).div(10000).add(solverExcess).toString());
        if (jamOrder.buyTokens[i] === TOKENS.ETH){
            maker_tokens.push(TOKENS.WETH)
            commands += "01"
        } else {
            maker_tokens.push(jamOrder.buyTokens[i])
            commands += "00"
        }
    }

    let nativeTokenAmount = BigNumber.from(0)
    let solverCalls: JamInteraction.DataStruct[] = []
    for (let i = 0; i < jamOrder.sellTokens.length; i++){
        taker_amounts.push(BigNumber.from(jamOrder.sellAmounts[i]).mul(curFillPercent).div(10000))
        if (jamOrder.sellTokens[i] === TOKENS.ETH){
            taker_tokens.push(TOKENS.WETH)
            nativeTokenAmount = nativeTokenAmount.add(taker_amounts[i])
            commands += "01"
        } else {
            let tokenContract = await ethers.getContractAt("IERC20", jamOrder.sellTokens[i])
            const bebopApprovalTxToken = await tokenContract.populateTransaction.approve(bebop.address, taker_amounts[i])
            solverCalls.push({ result: true, to: bebopApprovalTxToken.to!, data: bebopApprovalTxToken.data!, value: 0 })
            taker_tokens.push(jamOrder.sellTokens[i])
            commands += "00"
        }
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
        "commands": commands
    }
    const maker_sig = await maker._signTypedData(BEBOP_DOMAIN, PARTIAL_ORDER_TYPES, partialOrder)
    for (let i = 0; i < maker_tokens.length; i++){
        let tokenContract = await ethers.getContractAt("IERC20", maker_tokens[i])
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
        "commands": commands
    }

    const settleTx = await bebop.populateTransaction.SettleAggregateOrder(
        aggregateOrder,
        { signatureType: 0, signatureBytes: '0x'},
        [ {  signature: { signatureType: 0, signatureBytes: maker_sig }, usingPermit2: false }]
    )

    solverCalls.push({ result: true, to: settleTx.to!, data: settleTx.data!, value: nativeTokenAmount.toString() })
    return solverCalls
}