import {JamInteraction, JamOrderStruct} from "../../../typechain-types/artifacts/src/JamSettlement";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {BigNumber, utils} from "ethers";
import {TOKENS} from "../config";
import {BebopSettlement, IBebopBlend} from "../../../typechain-types";
import {
    BlendAggregateOrderStruct,
    BlendMultiOrderStruct,
    BlendSingleOrderStruct
} from "../../../typechain-types/artifacts/src/interfaces/IBebopBlend";
import {BlendCommand, getMultiOrder, getSingleOrder} from "./blendUtils";
import {makerSignBlendOrder} from "../signing/signBebopBlend";



export async function getBebopSolverCalls(
    jamOrder: JamOrderStruct,
    bebop: BebopSettlement,
    takerAddress: string,
    maker: SignerWithAddress,
    _solverExcess: BigNumber[] | number = 1000
): Promise<JamInteraction.DataStruct[]> {
    let solverExcess: BigNumber[] = []
    if (typeof _solverExcess === "number"){
        solverExcess = Array(jamOrder.buyTokens.length).fill(BigNumber.from(_solverExcess))
    } else {
        solverExcess = _solverExcess
    }
    const taker_address = takerAddress;
    const maker_address = maker.address;
    const taker_amounts = [];
    let maker_amounts = []
    let taker_tokens = [];
    let maker_tokens = [];
    let takerCommands: BlendCommand[] = []
    let makerCommands: BlendCommand[] = []
    for (let i = 0; i < jamOrder.buyTokens.length; i++){
        maker_amounts.push(BigNumber.from(jamOrder.buyAmounts[i]).add(solverExcess[i]).toString());
        if (jamOrder.buyTokens[i] === TOKENS.ETH){
            maker_tokens.push(TOKENS.WETH)
            makerCommands.push(BlendCommand.NATIVE_TRANSFER)
        } else {
            maker_tokens.push(jamOrder.buyTokens[i])
            makerCommands.push(BlendCommand.SIMPLE_TRANSFER)
        }
    }

    let nativeTokenAmount = BigNumber.from(0)
    let solverCalls: JamInteraction.DataStruct[] = []
    for (let i = 0; i < jamOrder.sellTokens.length; i++){
        taker_amounts.push(BigNumber.from(jamOrder.sellAmounts[i]))
        if (jamOrder.sellTokens[i] === TOKENS.ETH){
            taker_tokens.push(TOKENS.WETH)
            nativeTokenAmount = nativeTokenAmount.add(taker_amounts[i])
            takerCommands.push(BlendCommand.NATIVE_TRANSFER)
        } else {
            let tokenContract = await ethers.getContractAt("IERC20", jamOrder.sellTokens[i])
            const bebopApprovalTxToken = await tokenContract.populateTransaction.approve(bebop.address, taker_amounts[i])
            solverCalls.push({ result: true, to: bebopApprovalTxToken.to!, data: bebopApprovalTxToken.data!, value: 0 })
            taker_tokens.push(jamOrder.sellTokens[i])
            takerCommands.push(BlendCommand.SIMPLE_TRANSFER)
        }
    }

    let settleTx;
    if (maker_tokens.length === 1 && taker_tokens.length === 1){
        //SingleOrder
        const singleOrder: BlendSingleOrderStruct = getSingleOrder(
            taker_tokens[0], maker_tokens[0], taker_amounts[0], maker_amounts[0],
            taker_address, maker_address, takerCommands[0], makerCommands[0]
        )
        const makerSignature = await makerSignBlendOrder(maker, singleOrder, bebop.address)
        settleTx = await bebop.populateTransaction.swapSingle(
            singleOrder,
            { flags: 0, signatureBytes: makerSignature},
            0
        )
    } else {
        const multiOrder: BlendMultiOrderStruct = getMultiOrder(
            taker_tokens, maker_tokens, taker_amounts, maker_amounts,
            taker_address, maker_address, takerCommands, makerCommands
        )
        const makerSignature = await makerSignBlendOrder(maker, multiOrder, bebop.address)
        settleTx = await bebop.populateTransaction.swapMulti(
            multiOrder,
            { flags: 0, signatureBytes: makerSignature},
            0
        )
    }
    for (let i = 0; i < maker_tokens.length; i++){
        let tokenContract = await ethers.getContractAt("IERC20", maker_tokens[i])
        await tokenContract.connect(maker).approve(bebop.address, maker_tokens[i])
    }

    solverCalls.push({ result: true, to: settleTx.to!, data: settleTx.data!, value: nativeTokenAmount.toString() })
    return solverCalls
}


export function encodeSingleBlendOrderArgsForJam(
    order: BlendSingleOrderStruct, makerSignature: IBebopBlend.MakerSignatureStruct, oldQuoteSingle: IBebopBlend.OldSingleQuoteStruct, signature: string
){
    return utils.defaultAbiCoder.encode(
        [
            "(uint256,address,address,uint256,address,address,uint256,uint256,address,uint256,uint256)",
            "(bytes,uint256)",
            "(bool,uint256,uint256)",
            "bytes"
        ], [
            Object.values(order),
            Object.values(makerSignature),
            Object.values(oldQuoteSingle),
            signature
        ]
    )
}

export function encodeMultiBlendOrderArgsForJam(
    order: BlendMultiOrderStruct, makerSignature: IBebopBlend.MakerSignatureStruct, oldQuoteMulti: IBebopBlend.OldMultiQuoteStruct, signature: string
){
    return utils.defaultAbiCoder.encode(
        [
            "(uint256,address,address,uint256,address[],address[],uint256[],uint256[],address,bytes,uint256)",
            "(bytes,uint256)",
            "(bool,uint256[],uint256)",
            "bytes"
        ], [
            Object.values(order),
            Object.values(makerSignature),
            Object.values(oldQuoteMulti),
            signature
        ]
    )
}

export function encodeAggregateBlendOrderArgsForJam(
    order: BlendAggregateOrderStruct, makerSignatures: IBebopBlend.MakerSignatureStruct[], oldQuoteAggregate: IBebopBlend.OldAggregateQuoteStruct, signature: string
){
    return utils.defaultAbiCoder.encode(
        [
            "(uint256,address,address[],uint256[],address[][],address[][],uint256[][],uint256[][],address,bytes,uint256)",
            "(bytes,uint256)[]",
            "(bool,uint256[][],uint256[])",
            "bytes"
        ], [
            Object.values(order),
            makerSignatures.map(ss => Object.values(ss)),
            Object.values(oldQuoteAggregate),
            signature
        ]
    )
}