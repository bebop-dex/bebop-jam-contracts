import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement} from "../../../typechain-types/artifacts/src/JamSettlement";
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
        { "name": "nonce", "type": "uint256" },
        { "name": "executor", "type": "address" },
        { "name": "minFillPercent", "type": "uint16" },
        { "name": "hooksHash", "type": "bytes32" },
        { "name": "sellTokens", "type": "address[]" },
        { "name": "buyTokens", "type": "address[]" },
        { "name": "sellAmounts", "type": "uint256[]" },
        { "name": "buyAmounts", "type": "uint256[]" },
        { "name": "sellNFTIds", "type": "uint256[]" },
        { "name": "buyNFTIds", "type": "uint256[]" },
        { "name": "sellTokenTransfers", "type": "bytes" },
        { "name": "buyTokenTransfers", "type": "bytes" },
    ]
}

export async function signPermit2AndJam(user: Signer & TypedDataSigner, order: JamOrder.DataStruct, spender: string): Promise<string>{
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
        witness: order,
        witnessTypeName: "JamOrder",
        witnessType: JAM_ORDER_TYPES
    }
    let permitMsgTyped = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId, witness)
    const { domain, types, values } = permitMsgTyped
    return await user._signTypedData(domain, types, values)
}

export async function signJamOrder(user: SignerWithAddress, order: JamOrder.DataStruct, settlement: JamSettlement): Promise<string> {
    const JAM_DOMAIN = {
        "name": "JamSettlement",
        "version": "1",
        "chainId": await user.getChainId(),
        "verifyingContract": settlement.address
    }
    return await user._signTypedData(JAM_DOMAIN, JAM_ORDER_TYPES, order);
}
