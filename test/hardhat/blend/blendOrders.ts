import {
    BlendAggregateOrderStruct,
    BlendMultiOrderStruct,
    BlendSingleOrderStruct
} from "../../../typechain-types/artifacts/src/interfaces/IBebopBlend";
import {generateExpiry} from "../utils/utils";
import {AMOUNTS, AMOUNTS2, TOKENS} from "../config";
import {BlendCommand, generateTakerFlags, getCommandsString} from "./blendUtils";


export function getSingleBlendOrder(
    orderName: string, jamSettlement: string, makerAddress: string, userAddress: string, partnerId: number = 0
): BlendSingleOrderStruct {
    let nonce = Math.floor(Math.random() * 1000000)
    let order: BlendSingleOrderStruct;
    if (orderName === "Simple") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_address: makerAddress,
            maker_nonce: nonce,
            taker_token: TOKENS.WETH,
            maker_token: TOKENS.DAI,
            taker_amount: AMOUNTS[TOKENS.WETH],
            maker_amount: AMOUNTS[TOKENS.DAI],
            receiver: userAddress,
            packed_commands: 0,
            flags: generateTakerFlags(0, partnerId)
        }
    } else if (orderName === "SimpleERC20Permit") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_address: makerAddress,
            maker_nonce: nonce,
            taker_token: TOKENS.USDC,
            maker_token: TOKENS.USDT,
            taker_amount: AMOUNTS[TOKENS.USDC],
            maker_amount: AMOUNTS[TOKENS.USDT],
            receiver: userAddress,
            packed_commands: 0,
            flags: generateTakerFlags(0 , partnerId)
        }
    } else if (orderName === "NativeToJamSettlement") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_address: makerAddress,
            maker_nonce: nonce,
            taker_token: TOKENS.USDC,
            maker_token: TOKENS.WETH,
            taker_amount: AMOUNTS[TOKENS.USDC],
            maker_amount: AMOUNTS[TOKENS.WETH],
            receiver: jamSettlement,
            packed_commands: 2, // that means maker has native token
            flags: generateTakerFlags(0 , partnerId)
        }
    } else {
        throw new Error("Order not found")
    }
    return order
}

export function getMultiBlendOrder(
    orderName: string,
    jamSettlement: string,
    makerAddress: string,
    userAddress: string,
    partnerId: number = 0,
    takerTransfersTypes: BlendCommand[] | undefined = undefined,
    makerTransfersTypes: BlendCommand[] | undefined = undefined,
): BlendMultiOrderStruct {
    let nonce = Math.floor(Math.random() * 1000000)
    let order: BlendMultiOrderStruct;
    if (orderName === "One-to-Many") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_address: makerAddress,
            maker_nonce: nonce,
            taker_tokens: [TOKENS.WETH],
            maker_tokens: [TOKENS.USDC, TOKENS.DAI],
            taker_amounts: [AMOUNTS[TOKENS.WETH]],
            maker_amounts: [AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.DAI]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
    } else if (orderName === "Many-to-One") {
            order = {
                expiry: generateExpiry(),
                taker_address: jamSettlement,
                maker_address: makerAddress,
                maker_nonce: nonce,
                taker_tokens: [TOKENS.USDC, TOKENS.DAI],
                maker_tokens: [TOKENS.WETH],
                taker_amounts: [AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.DAI]],
                maker_amounts: [AMOUNTS[TOKENS.WETH]],
                receiver: userAddress,
                commands: "0x",
                flags: generateTakerFlags(0 , partnerId)
            }
    } else {
        throw new Error("Order not found")
    }
    if (takerTransfersTypes === undefined) {
        takerTransfersTypes = order.taker_tokens.map(() => BlendCommand.SIMPLE_TRANSFER)
    }
    if (makerTransfersTypes === undefined) {
        makerTransfersTypes = order.maker_tokens.map(() => BlendCommand.SIMPLE_TRANSFER)
    }
    order.commands = "0x" + makerTransfersTypes.join('') + takerTransfersTypes.join('')
    return order
}

export function getAggregateBlendOrder(
    orderName: string,
    jamSettlement: string,
    makerAddresses: string[],
    userAddress: string,
    partnerId: number = 0
): [BlendAggregateOrderStruct, BlendCommand[][], BlendCommand[][]]  {
    let nonces = makerAddresses.map(_ => Math.floor(Math.random() * 1000000))
    let order: BlendAggregateOrderStruct;
    let takerTransfersTypes: BlendCommand[][] | undefined = undefined
    let makerTransfersTypes: BlendCommand[][] | undefined = undefined
    if (orderName === "One-to-One") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WETH], [TOKENS.WETH]],
            maker_tokens: [[TOKENS.USDC], [TOKENS.USDC]],
            taker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS2[TOKENS.WETH]]],
            maker_amounts: [[AMOUNTS[TOKENS.USDC]], [AMOUNTS2[TOKENS.USDC]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
    } else if (orderName === "One-to-Many") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WETH], [TOKENS.WETH]],
            maker_tokens: [[TOKENS.WBTC, TOKENS.USDC, TOKENS.DAI], [TOKENS.UNI, TOKENS.WBTC]],
            taker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS[TOKENS.WETH]]],
            maker_amounts: [[AMOUNTS2[TOKENS.WBTC], AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.DAI]], [AMOUNTS[TOKENS.UNI], AMOUNTS[TOKENS.WBTC]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
    } else if (orderName === "One-to-Many with native token") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.USDT], [TOKENS.USDT]],
            maker_tokens: [[TOKENS.WETH, TOKENS.USDC], [TOKENS.WETH]],
            taker_amounts: [[AMOUNTS[TOKENS.USDT]], [AMOUNTS[TOKENS.USDT]]],
            maker_amounts: [[AMOUNTS2[TOKENS.WETH], AMOUNTS[TOKENS.USDC]], [AMOUNTS[TOKENS.WETH]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
        takerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER], [BlendCommand.SIMPLE_TRANSFER]]
        makerTransfersTypes = [[BlendCommand.NATIVE_TRANSFER, BlendCommand.SIMPLE_TRANSFER], [BlendCommand.NATIVE_TRANSFER]]
    } else if (orderName === "Many-to-One") {
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WBTC, TOKENS.USDC, TOKENS.DAI], [TOKENS.UNI, TOKENS.WBTC]],
            maker_tokens: [[TOKENS.WETH], [TOKENS.WETH]],
            taker_amounts: [[AMOUNTS2[TOKENS.WBTC], AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.DAI]], [AMOUNTS[TOKENS.UNI], AMOUNTS[TOKENS.WBTC]]],
            maker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS[TOKENS.WETH]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
    } else if (orderName === "One-to-One with extra hop") {
        // WETH -> UNI trade (USDC is middle token)
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WETH], [TOKENS.USDC]],
            maker_tokens: [[TOKENS.USDC], [TOKENS.UNI]],
            taker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS[TOKENS.USDC]]],
            maker_amounts: [[AMOUNTS[TOKENS.USDC]], [AMOUNTS[TOKENS.UNI]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
        takerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER], [BlendCommand.TRANSFER_FROM_CONTRACT]]
        makerTransfersTypes = [[BlendCommand.TRANSFER_TO_CONTRACT], [BlendCommand.SIMPLE_TRANSFER]]
    } else if (orderName === "One-to-One with 3 makers") {
        // WETH -> UNI trade (USDC is middle token)
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WETH], [TOKENS.USDC], [TOKENS.USDC]],
            maker_tokens: [[TOKENS.UNI, TOKENS.USDC], [TOKENS.UNI], [TOKENS.UNI]],
            taker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS[TOKENS.USDC]], [AMOUNTS[TOKENS.USDC]]],
            maker_amounts: [[AMOUNTS[TOKENS.UNI], AMOUNTS2[TOKENS.USDC]], [AMOUNTS[TOKENS.UNI]], [AMOUNTS[TOKENS.UNI]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
        takerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER], [BlendCommand.TRANSFER_FROM_CONTRACT], [BlendCommand.TRANSFER_FROM_CONTRACT]]
        makerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER, BlendCommand.TRANSFER_TO_CONTRACT], [BlendCommand.SIMPLE_TRANSFER], [BlendCommand.SIMPLE_TRANSFER]]
    } else if ("Many-to-One 3 makers with hop"){
        // WETH, USDT -> UNI trade (USDC is middle token)
        order = {
            expiry: generateExpiry(),
            taker_address: jamSettlement,
            maker_addresses: makerAddresses,
            maker_nonces: nonces,
            taker_tokens: [[TOKENS.WETH, TOKENS.USDT], [TOKENS.WETH], [TOKENS.USDT, TOKENS.USDC]],
            maker_tokens: [ [TOKENS.UNI], [TOKENS.USDC], [TOKENS.UNI]],
            taker_amounts: [[AMOUNTS[TOKENS.WETH]], [AMOUNTS[TOKENS.USDT], AMOUNTS[TOKENS.USDC]], [AMOUNTS2[TOKENS.WETH], AMOUNTS2[TOKENS.USDT]]],
            maker_amounts: [[AMOUNTS[TOKENS.USDC]], [AMOUNTS[TOKENS.UNI]], [AMOUNTS2[TOKENS.UNI]]],
            receiver: userAddress,
            commands: "0x",
            flags: generateTakerFlags(0, partnerId)
        }
        takerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER, BlendCommand.SIMPLE_TRANSFER], [BlendCommand.SIMPLE_TRANSFER], [BlendCommand.SIMPLE_TRANSFER, BlendCommand.TRANSFER_FROM_CONTRACT]]
        makerTransfersTypes = [[BlendCommand.SIMPLE_TRANSFER], [BlendCommand.TRANSFER_TO_CONTRACT], [BlendCommand.SIMPLE_TRANSFER]]
    } else {
        throw new Error("Order not found")
    }
    if (takerTransfersTypes === undefined) {
        takerTransfersTypes = []
        for (let i = 0; i < makerAddresses.length; i++) {
            takerTransfersTypes.push(order.taker_tokens[i].map(() => BlendCommand.SIMPLE_TRANSFER))
        }
    }
    if (makerTransfersTypes === undefined) {
        makerTransfersTypes = []
        for (let i = 0; i < makerAddresses.length; i++) {
            makerTransfersTypes.push(order.maker_tokens[i].map(() => BlendCommand.SIMPLE_TRANSFER))
        }
    }
    order.commands = getCommandsString(takerTransfersTypes, makerTransfersTypes)
    return [order, takerTransfersTypes, makerTransfersTypes]
}
