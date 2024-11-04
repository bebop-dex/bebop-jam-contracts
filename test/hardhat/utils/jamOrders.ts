import {AMOUNTS, AMOUNTS2, TOKENS} from "../config";
import {JamOrderStruct} from "../../../typechain-types/artifacts/src/JamSettlement";
import {BigNumber} from "ethers";



export function getOrder(
    orderType: string,
    takerAddress: string,
    executor: string,
    usingPermit2: boolean,
    _partnerInfo: BigNumber | undefined = undefined,
    _expiry: number | undefined = undefined,
    _exclusivityDeadline: number | undefined = undefined
): JamOrderStruct {
    let partnerInfo = _partnerInfo === undefined ? 0 : _partnerInfo;
    let expiry = _expiry === undefined ? Math.floor(Date.now() / 1000) + 1000 : _expiry;
    let exclusivityDeadline = _exclusivityDeadline === undefined ? expiry : _exclusivityDeadline;
    let nonce = Math.floor(Math.random() * 1000000);
    let common = {
        taker: takerAddress,
        receiver: takerAddress,
        expiry,
        exclusivityDeadline,
        nonce,
        executor,
        partnerInfo,
        usingPermit2
    }
    if (orderType === "Simple"){
        return {
            ...common,
            sellTokens: [TOKENS.WETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "SimpleWETH"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH]]
        }
    }
    if (orderType === "SimpleUSDT"){
        return {
            ...common,
            sellTokens: [TOKENS.USDT],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS2[TOKENS.USDT]],
            buyAmounts: [AMOUNTS2[TOKENS.USDC]]
        }
    }
    if (orderType === "UsingDaiPermit"){
        return {
            ...common,
            sellTokens: [TOKENS.DAI],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.DAI]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "ERC20-Permit"){
        return {
            ...common,
            sellTokens: [TOKENS.AAVE],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.AAVE]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "SellNative"){
        return {
            ...common,
            sellTokens: [TOKENS.ETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "BuyNative"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH]]
        }
    }
    if (orderType === "BuyNativeAndWrapped"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH, TOKENS.WETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS2[TOKENS.WETH]]
        }
    }
    if (orderType === "Many-to-One"){
        return {
            ...common,
            sellTokens: [TOKENS.WETH, TOKENS.USDT, TOKENS.WBTC],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.USDT], AMOUNTS[TOKENS.WBTC]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "One-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.USDC]]
        }
    }
    if (orderType === "One-to-Many-another"){
        return {
            ...common,
            buyTokens: [TOKENS.SNX, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.DYDX],
            buyAmounts: [AMOUNTS.SNX_1, AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.DYDX]]
        }
    }
    if (orderType === "Many-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC, TOKENS.YFI, TOKENS.MKR],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.YFI], AMOUNTS[TOKENS.MKR]]
        }
    }
    throw new Error("Order type not supported")
}