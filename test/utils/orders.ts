import {JamOrder} from "../../typechain-types/artifacts/src/JamSettlement";
import {NFTS_ERC1155, NFTS_ERC721, TOKENS} from "../config";
import {ethers} from "hardhat";


export enum Commands {
    SIMPLE_TRANSFER = "00",
    PERMIT2_TRANSFER ="01",
    NATIVE_TRANSFER = "02",
    UNWRAP_AND_TRANSFER = "03",
    NFT_ERC721_TRANSFER = "04",
    NFT_ERC1155_TRANSFER = "05"
}

const AMOUNTS = {
    "WETH_1": ethers.utils.parseUnits("1", 18).toString(),
    "DAI_1": ethers.utils.parseUnits("1000", 18).toString(),
    "USDC_1": ethers.utils.parseUnits("123", 6).toString(),
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
    if (orderType === "BuyERC721"){
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: [NFTS_ERC721.pLoot.address],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [1],
            sellNFTIds: [],
            buyNFTIds: [NFTS_ERC721.pLoot.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "BuyERC1155"){
        return {
            sellTokens: [TOKENS.WETH],
            buyTokens: [NFTS_ERC1155.opensea.address],
            sellAmounts: [AMOUNTS.WETH_1],
            buyAmounts: [NFTS_ERC1155.opensea.amount],
            sellNFTIds: [],
            buyNFTIds: [NFTS_ERC1155.opensea.id],
            taker: takerAddress,
            receiver: takerAddress,
            nonce: nonce,
            expiry,
            hooksHash: "",
            buyTokenTransfers: "0x" + buyCommands.join(""),
            sellTokenTransfers: "0x" + sellCommands.join("")
        }
    }
    if (orderType === "SellERC721"){
        return {
            sellTokens: [NFTS_ERC721.Card.address],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [1],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [NFTS_ERC721.Card.id],
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
    if (orderType === "SellERC1155"){
        return {
            sellTokens: [NFTS_ERC1155.hub.address],
            buyTokens: [TOKENS.WETH],
            sellAmounts: [NFTS_ERC1155.hub.amount],
            buyAmounts: [AMOUNTS.WETH_1],
            sellNFTIds: [NFTS_ERC1155.hub.id],
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
    throw new Error("Order type not supported")
}