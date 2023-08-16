import {JamOrder} from "../../typechain-types/artifacts/src/JamSettlement";
import {NFTS_ERC1155, NFTS_ERC721, TOKENS} from "../config";
import {ethers} from "hardhat";


export enum Commands {
    SIMPLE_TRANSFER = "00",
    PERMIT2_TRANSFER ="01",
    NATIVE_TRANSFER = "02",
    NFT_ERC721_TRANSFER = "04",
    NFT_ERC1155_TRANSFER = "05"
}

const AMOUNTS = {
    "WETH_1": ethers.utils.parseUnits("1", 18).toString(),
    "DAI_1": ethers.utils.parseUnits("1000", 18).toString(),
    "USDC_1": ethers.utils.parseUnits("123", 6).toString(),
    "WBTC_1": ethers.utils.parseUnits("0.1", 8).toString(),
    "LINK_1": ethers.utils.parseUnits("2", 18).toString(),
    "MKR_1": ethers.utils.parseUnits("1", 18).toString(),
    "YFI_1": ethers.utils.parseUnits("1", 18).toString(),
}

export function getOrder(orderType: string, takerAddress: string, sellCommands: Commands[], buyCommands: Commands[]): JamOrder.DataStruct {
    let expiry = Math.floor(Date.now() / 1000) + 1000;
    let nonce = Math.floor(Math.random() * 1000000);
    if (orderType === "Simple"){
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "UsingDaiPermit"){
        return {
            sellTokens: [TOKENS.DAI],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.DAI_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "SimpleReverse"){
        return {
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "SellNative"){
        return {
            sellTokens: [TOKENS.ETH],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "BuyNative"){
        return {
            sellTokens: [TOKENS.USDC],
            buyTokens: [TOKENS.ETH],
            sellAmounts: [AMOUNTS.USDC_1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "BuyERC721" || orderType === "BuyERC721-Repeated"){
        let buyTokens = orderType === "BuyERC721" ? [NFTS_ERC721.bayc.address] : [NFTS_ERC721.ens.address]
        let buyIds = orderType === "BuyERC721" ? [NFTS_ERC721.bayc.id] : [NFTS_ERC721.ens.id]
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: buyTokens,
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [1],
            sellNFTIds: [],
            buyNFTIds: buyIds,
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "BuyERC1155" || orderType === "BuyERC1155-Repeated"){
        let buyTokens = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.address] : [NFTS_ERC1155.ronin.address]
        let buyIds = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.id] : [NFTS_ERC1155.ronin.id]
        let buyAmounts = orderType === "BuyERC1155" ? [NFTS_ERC1155.opensea.amount] : [NFTS_ERC1155.ronin.amount]
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: buyTokens,
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: buyAmounts,
            sellNFTIds: [],
            buyNFTIds: buyIds,
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "SellERC721" || orderType === "SellERC721-Repeated"){
        let sellTokens = orderType === "SellERC721" ? [NFTS_ERC721.coolcats.address] : [NFTS_ERC721.bayc.address]
        let sellNFTIds = orderType === "SellERC721" ? [NFTS_ERC721.coolcats.id] : [NFTS_ERC721.bayc.id]
        return {
            sellTokens: sellTokens,
            buyTokens: [TOKENS.WETH],
            sellAmounts: [1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: sellNFTIds,
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "SellERC1155" || orderType === "SellERC1155-Repeated"){
        let sellTokens = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.address] : [NFTS_ERC1155.opensea.address]
        let sellNFTIds = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.id] : [NFTS_ERC1155.opensea.id]
        let sellAmounts = orderType === "SellERC1155" ? [NFTS_ERC1155.rtfkt.amount] : [NFTS_ERC1155.opensea.amount]
        return {
            sellTokens: sellTokens,
            buyTokens: [TOKENS.WETH],
            sellAmounts: sellAmounts,
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: sellNFTIds,
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "Many-to-One"){
        return {
            sellTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            buyTokens: [TOKENS.USDC],
            sellAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            buyAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "One-to-Many"){
        return {
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC],
            buyAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            sellAmounts: [AMOUNTS.USDC_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "Many-to-Many"){
        return {
            buyTokens: [TOKENS.WETH, TOKENS.LINK, TOKENS.WBTC],
            sellTokens: [TOKENS.USDC, TOKENS.YFI, TOKENS.MKR],
            buyAmounts: [AMOUNTS.WETH_1, AMOUNTS.LINK_1, AMOUNTS.WBTC_1],
            sellAmounts: [AMOUNTS.USDC_1, AMOUNTS.YFI_1, AMOUNTS.MKR_1],
            sellNFTIds: [],
            buyNFTIds: [],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "NFT-to-NFT"){
        return {
            sellTokens: [NFTS_ERC721.ens.address],
            buyTokens: [NFTS_ERC721.coolcats.address],
            sellAmounts: [1],
            buyAmounts: [1],
            sellNFTIds: [NFTS_ERC721.ens.id],
            buyNFTIds: [NFTS_ERC721.coolcats.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "NFTs-to-NFTs"){
        return {
            sellTokens: [NFTS_ERC721.coolcats.address, NFTS_ERC1155.ronin.address],
            buyTokens: [NFTS_ERC1155.rtfkt.address, NFTS_ERC721.ens.address],
            sellAmounts: [1, NFTS_ERC1155.ronin.amount],
            buyAmounts: [NFTS_ERC1155.rtfkt.amount, 1],
            sellNFTIds: [NFTS_ERC721.coolcats.id, NFTS_ERC1155.ronin.id],
            buyNFTIds: [NFTS_ERC1155.rtfkt.id, NFTS_ERC721.ens.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "NFT-to-NFT+ETH"){
        return {
            sellTokens: [NFTS_ERC721.ens.address],
            buyTokens: [TOKENS.ETH, NFTS_ERC721.bayc.address],
            sellAmounts: [1],
            buyAmounts: [AMOUNTS.WETH_1, 1],
            sellNFTIds: [NFTS_ERC721.ens.id],
            buyNFTIds: [NFTS_ERC721.bayc.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "WETH+NFT-to-NFT"){
        return {
            sellTokens: [NFTS_ERC721.bayc.address, TOKENS.WETH],
            buyTokens: [NFTS_ERC721.ens.address],
            sellAmounts: [1, AMOUNTS.WETH_1],
            buyAmounts: [1],
            sellNFTIds: [NFTS_ERC721.bayc.id],
            buyNFTIds: [NFTS_ERC721.ens.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    throw new Error("Order type not supported")
}