import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrderStruct, JamSettlement} from "../../../typechain-types/artifacts/src/JamSettlement";
import {Signer} from "ethers";
import {PERMIT2_ADDRESS} from "../config";
import {TypedDataSigner} from "@ethersproject/abstract-signer/src.ts";
import {PermitBatchTransferFrom, TokenPermissions} from "@uniswap/permit2-sdk/dist/signatureTransfer";
import {SignatureTransfer, Witness} from "@uniswap/permit2-sdk";

const JAM_ORDER_TYPES = {
    "JamOrder": [
        { "name": "taker", "type": "address" },
        { "name": "receiver", "type": "address" },
        { "name": "expiry", "type": "uint256" },
        { "name": "exclusivityDeadline", "type": "uint256" },
        { "name": "nonce", "type": "uint256" },
        { "name": "executor", "type": "address" },
        { "name": "partnerInfo", "type": "uint256" },
        { "name": "sellTokens", "type": "address[]" },
        { "name": "buyTokens", "type": "address[]" },
        { "name": "sellAmounts", "type": "uint256[]" },
        { "name": "buyAmounts", "type": "uint256[]" },
        { "name": "hooksHash", "type": "bytes32" }
    ]
}

function toDictForSigning(order: JamOrderStruct, hooksHash: string): any {
    return {
        taker: order.taker,
        receiver: order.receiver,
        expiry: order.expiry,
        exclusivityDeadline: order.exclusivityDeadline,
        nonce: order.nonce,
        executor: order.executor,
        partnerInfo: order.partnerInfo,
        sellTokens: order.sellTokens,
        buyTokens: order.buyTokens,
        sellAmounts: order.sellAmounts,
        buyAmounts: order.buyAmounts,
        hooksHash: hooksHash
    }
}

export async function signPermit2AndJam(user: Signer & TypedDataSigner, order: JamOrderStruct, hooksHash: string, spender: string): Promise<string>{
    let chainId: number = await user.getChainId()

    let tokenDetails: TokenPermissions[] = []
    for (let i = 0; i < order.sellTokens.length; i++) {
        tokenDetails.push({
            token: order.sellTokens[i],
            amount: order.sellAmounts[i],
        })
    }
    let permit: PermitBatchTransferFrom = {
        permitted: tokenDetails,
        spender: spender,
        nonce: order.nonce,
        deadline: order.expiry
    }
    let witness: Witness = {
        witness: toDictForSigning(order, hooksHash),
        witnessTypeName: "JamOrder",
        witnessType: JAM_ORDER_TYPES
    }
    let permitMsgTyped = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId, witness)
    const { domain, types, values } = permitMsgTyped
    return await user._signTypedData(domain, types, values)
}

export async function signJamOrder(user: SignerWithAddress, order: JamOrderStruct, hooksHash: string, settlement: JamSettlement): Promise<string> {
    const JAM_DOMAIN = {
        "name": "JamSettlement",
        "version": "2",
        "chainId": await user.getChainId(),
        "verifyingContract": settlement.address
    }
    return await user._signTypedData(JAM_DOMAIN, JAM_ORDER_TYPES, toDictForSigning(order, hooksHash));
}
