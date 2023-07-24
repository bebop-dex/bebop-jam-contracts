import {JamOrder} from "../../typechain-types/artifacts/src/JamSettlement";
import {TOKENS} from "../config";
import {ethers} from "hardhat";


export enum Commands {
    SIMPLE_TRANSFER = "00",
    PERMIT2_TRANSFER ="01",
    NATIVE_TRANSFER = "02",
    NFT_ERC721_TRANSFER = "03"
}

const AMOUNTS = {
    "WETH_1": ethers.utils.parseUnits("1", 18).toString(),
    "USDC_1": ethers.utils.parseUnits("123", 6).toString(),
}

export function getOrder(orderType: string, takerAddress: string, sellCommands: Commands[]): JamOrder.DataStruct {
    let expiry = Math.floor(Date.now() / 1000) + 1000;
    let nonce = Math.floor(Math.random() * 1000000);
    if (orderType === "Simple"){
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [AMOUNTS.USDC_1],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x",
            sellTokenTransfers: "0x" + sellCommands.join(""),
        }
    }
    throw new Error("Order type not supported")
}