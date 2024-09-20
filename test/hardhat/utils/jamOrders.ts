import {JamOrder} from "../../../typechain-types/artifacts/src/JamSettlement";
import {AMOUNTS, AMOUNTS2, NFTS_ERC1155, NFTS_ERC721, TOKENS} from "../config";
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


export function getOrder(
    orderType: string,
    takerAddress: string,
    executor: string,
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
        executor: executor,
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
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: [],
        }
    }
    if (orderType === "UsingDaiPermit"){
        return {
            ...common,
            sellTokens: [TOKENS.DAI],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.DAI]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "ERC20-Permit"){
        return {
            ...common,
            sellTokens: [TOKENS.AAVE],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.AAVE]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "SimpleReverse"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH]],
            sellNFTIds: [],
            buyNFTIds: [],
        }
    }
    if (orderType === "SellNative"){
        return {
            ...common,
            sellTokens: [TOKENS.ETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "BuyNative"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "BuyNativeAndWrapped"){
        return {
            ...common,
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH, TOKENS.WETH],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS2[TOKENS.WETH]],
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
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
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
            sellAmounts: [AMOUNTS[TOKENS.WETH]],
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
            buyAmounts: [AMOUNTS[TOKENS.WETH]],
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
            buyAmounts: [AMOUNTS[TOKENS.WETH]],
            sellNFTIds: sellNFTIds,
            buyNFTIds: []
        }
    }
    if (orderType === "Many-to-One"){
        return {
            ...common,
            sellTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "One-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "One-to-Many-another"){
        return {
            ...common,
            buyTokens: [TOKENS.SNX, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.DYDX],
            buyAmounts: [AMOUNTS.SNX_1, AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.DYDX]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "Many-to-Many"){
        return {
            ...common,
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC, TOKENS.YFI, TOKENS.MKR],
            buyAmounts: [AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            sellAmounts: [AMOUNTS[TOKENS.USDC], AMOUNTS[TOKENS.YFI], AMOUNTS[TOKENS.MKR]],
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
            buyAmounts: [AMOUNTS[TOKENS.WETH], 1],
            sellNFTIds: [NFTS_ERC721.ens.id],
            buyNFTIds: [NFTS_ERC721.bayc.id]
        }
    }
    if (orderType === "WETH+NFT-to-NFT"){
        return {
            ...common,
            sellTokens: [NFTS_ERC721.bayc.address, TOKENS.WETH],
            buyTokens: [NFTS_ERC721.ens.address],
            sellAmounts: [1, AMOUNTS[TOKENS.WETH]],
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
            sellAmounts: [AMOUNTS[TOKENS.UNI], AMOUNTS[TOKENS.WETH], AMOUNTS[TOKENS.LINK], AMOUNTS[TOKENS.WBTC]],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    if (orderType === "Permits-fresh-mix"){
        return {
            ...common,
            sellTokens: [TOKENS.DYDX, TOKENS.WETH, TOKENS.SNX],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS[TOKENS.DYDX], AMOUNTS[TOKENS.WETH], AMOUNTS.SNX_1],
            buyAmounts: [AMOUNTS[TOKENS.USDC]],
            sellNFTIds: [],
            buyNFTIds: []
        }
    }
    throw new Error("Order type not supported")
}