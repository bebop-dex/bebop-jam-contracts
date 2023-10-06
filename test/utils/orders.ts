import {JamOrder} from "../../typechain-types/artifacts/src/JamSettlement";
import {NFTS_ERC1155, NFTS_ERC721, TOKENS} from "../config";
import {ethers} from "hardhat";


export enum Commands {
    SIMPLE_TRANSFER = "00",
    PERMIT2_TRANSFER ="01",
    CALL_PERMIT_THEN_TRANSFER = "02",
    CALL_PERMIT2_THEN_TRANSFER = "03",
    NATIVE_TRANSFER = "04",
    NFT_ERC721_TRANSFER = "05",
    NFT_ERC1155_TRANSFER = "06",
}

const AMOUNTS = {
    "WETH_1": ethers.utils.parseUnits("1", 18).toString(),
    "WETH_2": ethers.utils.parseUnits("3", 18).toString(),
    "DAI_1": ethers.utils.parseUnits("1000", 18).toString(),
    "USDC_1": ethers.utils.parseUnits("123", 6).toString(),
    "WBTC_1": ethers.utils.parseUnits("0.1", 8).toString(),
    "LINK_1": ethers.utils.parseUnits("2", 18).toString(),
    "MKR_1": ethers.utils.parseUnits("1", 18).toString(),
    "YFI_1": ethers.utils.parseUnits("1", 18).toString(),
    "UNI_1": ethers.utils.parseUnits("12", 18).toString(),
    "AAVE_1": ethers.utils.parseUnits("0.2", 18).toString(),
    "DYDX_1": ethers.utils.parseUnits("11", 18).toString(),
    "SNX_1": ethers.utils.parseUnits("322", 18).toString(),
}

export function getOrder(
    orderType: string,
    takerAddress: string,
    sellCommands: Commands[],
    buyCommands: Commands[],
    _minFillPercent: number | undefined = undefined,
    _expiry: number | undefined = undefined
): JamOrder.DataStruct {
    let expiry = _expiry === undefined ? Math.floor(Date.now() / 1000) + 1000 : _expiry;
    let minFillPercent = _minFillPercent === undefined ? 10000 : _minFillPercent;
    let nonce = Math.floor(Math.random() * 1000000);
    let common = {
        taker: takerAddress,
        receiver: takerAddress,
        nonce: nonce,
        expiry,
        hooksHash: "",
        buyTokenTransfers: "0x" + buyCommands.join(""),
        sellTokenTransfers: "0x" + sellCommands.join(""),
        minFillPercent
    }
    if (orderType === "Simple"){
        return {
            ...common,
            sellTokens: [TOKENS.WETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
        }
    }
    if (orderType === "UsingDaiPermit"){
        return {
            ...common,
            sellTokens: [TOKENS.DAI],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.DAI_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "ERC20-Permit"){
        return {
            ...common,
            sellTokens: [TOKENS.AAVE],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.AAVE_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "SimpleReverse"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [],
            buyNFTIds: [],
        }
    }
    if (orderType === "SellNative"){
        return {
            ...common,
            sellTokens: [TOKENS.ETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "BuyNative"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "BuyNativeAndWrapped"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH, TOKENS.WETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1, AMOUNTS.WETH_2],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "BuyERC721" || orderType === "BuyERC721-Repeated"){
        let buyTokens = orderType === "BuyERC721" ? [NFTS_ERC721.bayc.address] : [NFTS_ERC721.ens.address]
        let buyIds = orderType === "BuyERC721" ? [NFTS_ERC721.bayc.id] : [NFTS_ERC721.ens.id]
        return {
            ...common,
            sellTokens: [TOKENS.WETH],
            buyTokens: buyTokens,
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [1],
            sellNFTIds: [],
            buyNFTIds: buyIds
        }
    }
    if (orderType === "BuyERC1155" || orderType === "BuyERC1155-Repeated"){
        let buyTokens = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.address] : [NFTS_ERC1155.ronin.address]
        let buyIds = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.id] : [NFTS_ERC1155.ronin.id]
        let buyAmounts = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.amount] : [NFTS_ERC1155.ronin.amount]
        return {
            ...common,
            sellTokens: [TOKENS.WETH],
            buyTokens: buyTokens,
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: buyAmounts,
            sellNFTIds: [],
            buyNFTIds: buyIds
        }
    }
    if (orderType === "SellERC721" || orderType === "SellERC721-Repeated"){
        let sellTokens = orderType === "SellERC721" ? [NFTS_ERC721.coolcats.address] : [NFTS_ERC721.bayc.address]
        let sellNFTIds = orderType === "SellERC721" ? [NFTS_ERC721.coolcats.id] : [NFTS_ERC721.bayc.id]
        return {
            ...common,
            sellTokens: sellTokens,
            buyTokens: [TOKENS.WETH],
            sellAmounts: [1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: sellNFTIds,
            buyNFTIds: []
        }
    }
    if (orderType === "SellERC1155" || orderType === "SellERC1155-Repeated"){
        let sellTokens = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.address] : [NFTS_ERC1155.opensea.address]
        let sellNFTIds = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.id] : [NFTS_ERC1155.opensea.id]
        let sellAmounts = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.amount] : [NFTS_ERC1155.opensea.amount]
        return {
            ...common,
            sellTokens: sellTokens,
            buyTokens: [TOKENS.WETH],
            sellAmounts: sellAmounts,
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: sellNFTIds,
            buyNFTIds: []
        }
    }
    if (orderType === "Many-to-One"){
        return {
            ...common,
            sellTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "One-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC],
            buyAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            sellAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "Many-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC, TOKENS.YFI, TOKENS.MKR],
            buyAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            sellAmounts: [AMOUNTS.USDC_1, AMOUNTS.YFI_1, AMOUNTS.MKR_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "NFT-to-NFT"){
        return {
            ...common,
            sellTokens: [NFTS_ERC721.ens.address],
            buyTokens: [NFTS_ERC721.coolcats.address],
            sellAmounts: [1],
            buyAmounts: [1],
            sellNFTIds: [NFTS_ERC721.ens.id],
            buyNFTIds: [NFTS_ERC721.coolcats.id]
        }
    }
    if (orderType === "NFTs-to-NFTs"){
        return {
            ...common,
            sellTokens: [NFTS_ERC721.coolcats.address, NFTS_ERC1155.ronin.address],
            buyTokens: [NFTS_ERC1155.rtfkt.address, NFTS_ERC721.ens.address],
            sellAmounts: [1, NFTS_ERC1155.ronin.amount],
            buyAmounts: [NFTS_ERC1155.rtfkt.amount, 1],
            sellNFTIds: [NFTS_ERC721.coolcats.id, NFTS_ERC1155.ronin.id],
            buyNFTIds: [NFTS_ERC1155.rtfkt.id, NFTS_ERC721.ens.id]
        }
    }
    if (orderType === "NFT-to-NFT+ETH"){
        return {
            ...common,
            sellTokens: [NFTS_ERC721.ens.address],
            buyTokens: [TOKENS.ETH, NFTS_ERC721.bayc.address],
            sellAmounts: [1],
            buyAmounts: [AMOUNTS.WETH_1, 1],
            sellNFTIds: [NFTS_ERC721.ens.id],
            buyNFTIds: [NFTS_ERC721.bayc.id]
        }
    }
    if (orderType === "WETH+NFT-to-NFT"){
        return {
            ...common,
            sellTokens: [NFTS_ERC721.bayc.address, TOKENS.WETH],
            buyTokens: [NFTS_ERC721.ens.address],
            sellAmounts: [1, AMOUNTS.WETH_1],
            buyAmounts: [1],
            sellNFTIds: [NFTS_ERC721.bayc.id],
            buyNFTIds: [NFTS_ERC721.ens.id]
        }
    }
    if (orderType === "Permits-mix"){
        return {
            ...common,
            sellTokens: [TOKENS.UNI, TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.UNI_1, AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "Permits-fresh-mix"){
        return {
            ...common,
            sellTokens: [TOKENS.DYDX, TOKENS.WETH, TOKENS.SNX],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.DYDX_1, AMOUNTS.WETH_1, AMOUNTS.SNX_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    throw new Error("Order type not supported")
}