import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {network} from "hardhat";
import {
    BlendAggregateOrderStruct,
    BlendMultiOrderStruct,
    BlendSingleOrderStruct
} from "../../../typechain-types/artifacts/src/interfaces/IBebopBlend";
import {IBebopBlend} from "../../../typechain-types/artifacts/src/JamBalanceManager";
import OldSingleQuoteStruct = IBebopBlend.OldSingleQuoteStruct;
import {BigNumber} from "ethers";
import {
    PermitBatchTransferFrom,
    PermitTransferFrom,
    TokenPermissions
} from "@uniswap/permit2-sdk/dist/signatureTransfer";
import {SignatureTransfer, Witness} from "@uniswap/permit2-sdk";
import {PERMIT2_ADDRESS} from "../config";
import OldMultiQuoteStruct = IBebopBlend.OldMultiQuoteStruct;
import {
    BlendCommand,
    getEventId,
    getTakerUniqueTokensForAggregate
} from "../blend/blendUtils";
import OldAggregateQuoteStruct = IBebopBlend.OldAggregateQuoteStruct;

export const SINGLE_ORDER_TYPES = {
    "SingleOrder": [
        { "name": "partner_id", "type": "uint64" },
        { "name": "expiry", "type": "uint256" },
        { "name": "taker_address", "type": "address" },
        { "name": "maker_address", "type": "address" },
        { "name": "maker_nonce", "type": "uint256" },
        { "name": "taker_token", "type": "address" },
        { "name": "maker_token", "type": "address" },
        { "name": "taker_amount", "type": "uint256" },
        { "name": "maker_amount", "type": "uint256" },
        { "name": "receiver", "type": "address" },
        { "name": "packed_commands", "type": "uint256" },
    ]
}

export const MULTI_ORDER_TYPES = {
    "MultiOrder": [
        { "name": "partner_id", "type": "uint64" },
        { "name": "expiry", "type": "uint256" },
        { "name": "taker_address", "type": "address" },
        { "name": "maker_address", "type": "address" },
        { "name": "maker_nonce", "type": "uint256" },
        { "name": "taker_tokens", "type": "address[]" },
        { "name": "maker_tokens", "type": "address[]" },
        { "name": "taker_amounts", "type": "uint256[]" },
        { "name": "maker_amounts", "type": "uint256[]" },
        { "name": "receiver", "type": "address" },
        { "name": "commands", "type": "bytes" },
    ]
}

export const AGGREGATE_ORDER_TYPES = {
    "AggregateOrder": [
        { "name": "partner_id", "type": "uint64" },
        { "name": "expiry", "type": "uint256" },
        { "name": "taker_address", "type": "address" },
        { "name": "maker_addresses", "type": "address[]" },
        { "name": "maker_nonces", "type": "uint256[]" },
        { "name": "taker_tokens", "type": "address[][]" },
        { "name": "maker_tokens", "type": "address[][]" },
        { "name": "taker_amounts", "type": "uint256[][]" },
        { "name": "maker_amounts", "type": "uint256[][]" },
        { "name": "receiver", "type": "address" },
        { "name": "commands", "type": "bytes" },
    ]
}

export async function makerSignBlendOrder(
    signer: SignerWithAddress,
    _order: BlendSingleOrderStruct | BlendMultiOrderStruct,
    bebopAddress: string,
    partner_id: number = 0,
    makerAddress: string | null = null
): Promise<string>{
    const BEBOP_DOMAIN = {
        "name": "BebopSettlement",
        "version": "2",
        "chainId": network.config.chainId,
        "verifyingContract": bebopAddress
    }
    let orderForSigning = {partner_id: partner_id, ..._order}
    if (makerAddress !== null){
        orderForSigning.maker_address = makerAddress
    }
    // @ts-ignore
    delete orderForSigning.flags
    if ((_order as BlendSingleOrderStruct).packed_commands !== undefined){
        return await signer._signTypedData(BEBOP_DOMAIN, SINGLE_ORDER_TYPES, orderForSigning)
    } else if ((_order as BlendMultiOrderStruct).maker_nonce !== undefined){
        return await signer._signTypedData(BEBOP_DOMAIN, MULTI_ORDER_TYPES, orderForSigning)
    } else {
        throw Error("Unknown order type")
    }
}

function toBlendOrderDictForJam(
    _order: BlendSingleOrderStruct | BlendMultiOrderStruct | BlendAggregateOrderStruct,
    hooksHash: string,
    partner_id: number = 0,
    signedValuesByTaker: OldSingleQuoteStruct | OldMultiQuoteStruct | OldAggregateQuoteStruct | null = null,
){
    let order: any = { ..._order}
    if (signedValuesByTaker !== null){
        if ((order as BlendSingleOrderStruct).packed_commands !== undefined){
            order.maker_amount = (signedValuesByTaker as OldSingleQuoteStruct).makerAmount
            order.maker_nonce = (signedValuesByTaker as OldSingleQuoteStruct).makerNonce
        } else if ((order as BlendMultiOrderStruct).maker_nonce !== undefined){
            order.maker_amounts = (signedValuesByTaker as OldMultiQuoteStruct).makerAmounts
            order.maker_nonce = (signedValuesByTaker as OldMultiQuoteStruct).makerNonce
        } else {
            order.maker_amounts = (signedValuesByTaker as OldAggregateQuoteStruct).makerAmounts
            order.maker_nonces = (signedValuesByTaker as OldAggregateQuoteStruct).makerNonces
        }
    }
    let fields = {
        "partner_id": partner_id, ...order, "hooksHash": hooksHash
    }
    // @ts-ignore
    delete fields.flags
    return fields
}

export async function signBlendSingleOrderAndPermit2(
    spender: string,
    user: SignerWithAddress,
    order: BlendSingleOrderStruct,
    hooksHash: string,
    partner_id: number = 0,
    signedValuesByTaker: OldSingleQuoteStruct | null = null
): Promise<string>{
    let fields = toBlendOrderDictForJam(order, hooksHash, partner_id, signedValuesByTaker)
    let chainId: number = await user.getChainId()
    let tokenDetails: TokenPermissions = {
        token: order.taker_token,
        amount: order.taker_amount
    }
    let permit: PermitTransferFrom = {
        permitted: tokenDetails,
        spender: spender,
        nonce: BigNumber.from(order.flags).shr(128),
        deadline: order.expiry
    }
    let SINGLE_ORDER_TYPES_WITH_HOOKS = JSON.parse(JSON.stringify(SINGLE_ORDER_TYPES))
    SINGLE_ORDER_TYPES_WITH_HOOKS.SingleOrder.push({ "name": "hooksHash", "type": "bytes32" })
    let witness: Witness = {
        witness: fields,
        witnessTypeName: "SingleOrder",
        witnessType: SINGLE_ORDER_TYPES_WITH_HOOKS
    }
    let permitMsgTyped = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId, witness)
    const { domain, types, values } = permitMsgTyped
    return await user._signTypedData(domain, types, values)
}

export async function signBlendMultiOrderAndPermit2(
    spender: string,
    user: SignerWithAddress,
    order: BlendMultiOrderStruct,
    hooksHash: string,
    partner_id: number = 0,
    signedValuesByTaker: OldMultiQuoteStruct | null = null
): Promise<string>{
    let fields = toBlendOrderDictForJam(order, hooksHash, partner_id, signedValuesByTaker)
    let chainId: number = await user.getChainId()
    let tokenDetails: TokenPermissions[] = []
    for (let i = 0; i < order.taker_tokens.length; i++){
        tokenDetails.push({
            token: order.taker_tokens[i],
            amount: order.taker_amounts[i]
        })
    }
    let permit: PermitBatchTransferFrom = {
        permitted: tokenDetails,
        spender: spender,
        nonce: getEventId(BigNumber.from(order.flags)),
        deadline: order.expiry
    }
    let MULTI_ORDER_TYPES_WITH_HOOKS = JSON.parse(JSON.stringify(MULTI_ORDER_TYPES))
    MULTI_ORDER_TYPES_WITH_HOOKS.MultiOrder.push({ "name": "hooksHash", "type": "bytes32" })
    let witness: Witness = {
        witness: fields,
        witnessTypeName: "MultiOrder",
        witnessType: MULTI_ORDER_TYPES_WITH_HOOKS
    }
    let permitMsgTyped = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId, witness)
    const { domain, types, values } = permitMsgTyped
    return await user._signTypedData(domain, types, values)
}


export async function signBlendAggregateOrderAndPermit2(
    spender: string,
    user: SignerWithAddress,
    order: BlendAggregateOrderStruct,
    hooksHash: string,
    takerTransfersTypes: BlendCommand[][],
    partner_id: number = 0,
    signedValuesByTaker: OldAggregateQuoteStruct | null = null
): Promise<string>{
    let fields = toBlendOrderDictForJam(order, hooksHash, partner_id, signedValuesByTaker)
    let chainId: number = await user.getChainId()
    let tokenDetails: TokenPermissions[] = []
    let [tokens, tokenAmounts] = getTakerUniqueTokensForAggregate(order, takerTransfersTypes)
    for (let i = 0; i < tokens.length; i++){
        tokenDetails.push({
            token: tokens[i],
            amount: tokenAmounts.get(tokens[i])!
        })
    }
    let permit: PermitBatchTransferFrom = {
        permitted: tokenDetails,
        spender: spender,
        nonce: getEventId(BigNumber.from(order.flags)),
        deadline: order.expiry
    }
    let AGGREGATE_ORDER_TYPES_WITH_HOOKS = JSON.parse(JSON.stringify(AGGREGATE_ORDER_TYPES))
    AGGREGATE_ORDER_TYPES_WITH_HOOKS.AggregateOrder.push({ "name": "hooksHash", "type": "bytes32" })
    let witness: Witness = {
        witness: fields,
        witnessTypeName: "AggregateOrder",
        witnessType: AGGREGATE_ORDER_TYPES_WITH_HOOKS
    }
    let permitMsgTyped = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId, witness)
    const { domain, types, values } = permitMsgTyped
    return await user._signTypedData(domain, types, values)
}




