// ETH Tokens
import {ethers} from "hardhat";

export const TOKENS = {
    "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "LINK": "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    "YFI": "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
    "MKR": "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    "AAVE": "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    "SNX": "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
    "DYDX": "0x92D6C1e31e14520e676a687F0a93788B716BEff5",
    "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
}

export const AMOUNTS = {
    [TOKENS.WETH]: ethers.utils.parseUnits("1", 18).toString(),
    [TOKENS.ETH]: ethers.utils.parseUnits("1", 18).toString(),
    [TOKENS.DAI]: ethers.utils.parseUnits("1000", 18).toString(),
    [TOKENS.USDC]: ethers.utils.parseUnits("123", 6).toString(),
    [TOKENS.USDT]: ethers.utils.parseUnits("120", 6).toString(),
    [TOKENS.WBTC]: ethers.utils.parseUnits("0.1", 8).toString(),
    [TOKENS.LINK]: ethers.utils.parseUnits("2", 18).toString(),
    [TOKENS.MKR]: ethers.utils.parseUnits("1", 18).toString(),
    [TOKENS.YFI]: ethers.utils.parseUnits("1", 18).toString(),
    [TOKENS.UNI]: ethers.utils.parseUnits("12", 18).toString(),
    [TOKENS.AAVE]: ethers.utils.parseUnits("0.2", 18).toString(),
    [TOKENS.DYDX]: ethers.utils.parseUnits("11", 18).toString(),
    [TOKENS.SNX]: ethers.utils.parseUnits("322", 18).toString()
}
export let AMOUNTS2: {[p: string]: string} = {};
Object.entries(AMOUNTS).forEach(([token, amount]) => {
    AMOUNTS2[token] = (BigInt(amount) * BigInt(2)).toString();
});

export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3"
export const BINANCE_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60"

export const ETH_RPC = "https://rpc.ankr.com/eth"
export const ETH_FOR_BLOCK = 17719907