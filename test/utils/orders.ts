import {JamOrder} from "../../typechain-types/artifacts/src/JamSettlement";
import {TOKENS} from "../config";
import {ethers} from "hardhat";


const AMOUNTS = {
    "WETH_1": ethers.utils.parseUnits("1", 18).toString(),
    "USDC_1": ethers.utils.parseUnits("1", 6).toString(),
}

export function getOrder(orderType: string, takerAddress: string){
    let expiry = Math.floor(Date.now() / 1000) + 1000;
    let nonce = Math.floor(Math.random() * 1000000);
    if (orderType === "Simple"){
        const jamOrder: JamOrder.DataStruct = {
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
        }
        return jamOrder
    }
}