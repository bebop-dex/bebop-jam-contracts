import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement, Signature} from "../../../typechain-types/artifacts/src/JamSettlement";
import {BigNumber, BigNumberish, BytesLike} from "ethers";
import {Commands} from "./orders";
import {ethers} from "hardhat";
import {expect} from "chai";
import {PERMIT2_ADDRESS} from "../config";

const JAM_ORDER_TYPES = {
    "JamOrder": [
        { "name": "taker", "type": "address" },
        { "name": "receiver", "type": "address" },
        { "name": "expiry", "type": "uint256" },
        { "name": "nonce", "type": "uint256" },
        { "name": "executor", "type": "address" },
        { "name": "minFillPercent", "type": "uint16" },
        { "name": "hooksHash", "type": "bytes32" },
        { "name": "sellTokens", "type": "address[]" },
        { "name": "buyTokens", "type": "address[]" },
        { "name": "sellAmounts", "type": "uint256[]" },
        { "name": "buyAmounts", "type": "uint256[]" },
        { "name": "sellNFTIds", "type": "uint256[]" },
        { "name": "buyNFTIds", "type": "uint256[]" },
        { "name": "sellTokenTransfers", "type": "bytes" },
        { "name": "buyTokenTransfers", "type": "bytes" },
    ]
}

export async function signJamOrder(user: SignerWithAddress, order: JamOrder.DataStruct, settlement: JamSettlement): Promise<Signature.TypedSignatureStruct> {
    const JAM_DOMAIN = {
        "name": "JamSettlement",
        "version": "1",
        "chainId": await user.getChainId(),
        "verifyingContract": settlement.address
    }
    const signatureBytes = await user._signTypedData(JAM_DOMAIN, JAM_ORDER_TYPES, order);
    return {
        signatureType: 1,
        signatureBytes: signatureBytes
    }
}


export async function approveTokens(
    tokens: string[], amounts: BigNumberish[], tokenTransfers: Commands[], user: SignerWithAddress, spender: string
): Promise<BigNumber> {
    let nativeTokenAmount = BigNumber.from(0)
    for (let i = 0; i < tokens.length; i++) {
        let curTokenContract = await ethers.getContractAt("IERC20", tokens[i])
        if (tokenTransfers[i] === Commands.SIMPLE_TRANSFER) {
            await curTokenContract.connect(user).approve(spender, amounts[i]);
        } else if (tokenTransfers[i] === Commands.PERMIT2_TRANSFER || tokenTransfers[i] === Commands.CALL_PERMIT2_THEN_TRANSFER) {
            await curTokenContract.connect(user).approve(PERMIT2_ADDRESS, amounts[i]);
        } else if (tokenTransfers[i] === Commands.NATIVE_TRANSFER) {
            nativeTokenAmount = nativeTokenAmount.add(BigNumber.from(amounts[i]))
        } else if (tokenTransfers[i] === Commands.NFT_ERC721_TRANSFER) {
            let nftTokenContract = await ethers.getContractAt("IERC721", tokens[i])
            await nftTokenContract.connect(user).setApprovalForAll(spender, true);
        } else if (tokenTransfers[i] === Commands.NFT_ERC1155_TRANSFER) {
            let nftTokenContract = await ethers.getContractAt("IERC1155", tokens[i])
            await nftTokenContract.connect(user).setApprovalForAll(spender, true);
        }
    }
    return nativeTokenAmount
}

export async function getBalancesBefore(
    tokens: string[], receiver: string, buyTokensTransfers: Commands[], buyNFTsIds: BigNumberish[], solverAddress: string
) {
    let userBalancesBefore: {[id:string]: BigNumberish} = {}
    let solverBalancesBefore: {[id:string]: BigNumberish} = {}
    let nftId = 0
    for (let [i, token] of tokens.entries()) {
        if (buyTokensTransfers[i] === Commands.NATIVE_TRANSFER) {
            userBalancesBefore[token] = await ethers.provider.getBalance(receiver)
            solverBalancesBefore[token] = await ethers.provider.getBalance(solverAddress)
        } else if (buyTokensTransfers[i] === Commands.NFT_ERC721_TRANSFER) {
            userBalancesBefore[token] = await (await ethers.getContractAt("IERC721", token)).balanceOf(receiver)
            solverBalancesBefore[token] = await (await ethers.getContractAt("IERC721", token)).balanceOf(solverAddress)
            nftId++
        } else if (buyTokensTransfers[i] === Commands.NFT_ERC1155_TRANSFER) {
            userBalancesBefore[token] = await (await ethers.getContractAt("IERC1155", token)).balanceOf(receiver, buyNFTsIds[nftId])
            solverBalancesBefore[token] = await (await ethers.getContractAt("IERC1155", token)).balanceOf(solverAddress, buyNFTsIds[nftId++])
        } else {
            userBalancesBefore[token] = await (await ethers.getContractAt("IERC20", token)).balanceOf(receiver)
            solverBalancesBefore[token] = await (await ethers.getContractAt("IERC20", token)).balanceOf(solverAddress)
        }
    }
    return [userBalancesBefore, solverBalancesBefore]
}


export async function verifyBalancesAfter(
    tokens: string[],
    receiver: string,
    sellTokensTransfers: Commands[],
    buyTokensTransfers: Commands[],
    buyNFTsIds: BigNumberish[],
    solverAddress: string,
    usingSolverContract: boolean,
    amounts: BigNumberish[],
    solverExcess: BigNumberish,
    userBalancesBefore: {[id:string]: BigNumberish},
    solverBalancesBefore: {[id:string]: BigNumberish},
    internalSettle: boolean,
    settlementAddr: string
){
    let takerGetExcess = !usingSolverContract && !internalSettle
    let nftId = 0
    for (let [i, token] of tokens.entries()) {
        let userBalanceAfter;
        let solverBalanceAfter;

        if (buyTokensTransfers[i] === Commands.NATIVE_TRANSFER) {
            userBalanceAfter = await ethers.provider.getBalance(receiver)
            solverBalanceAfter = await ethers.provider.getBalance(solverAddress)
        } else if (buyTokensTransfers[i] === Commands.NFT_ERC721_TRANSFER) {
            userBalanceAfter = await (await ethers.getContractAt("IERC721", token)).balanceOf(receiver)
            solverBalanceAfter = await (await ethers.getContractAt("IERC721", token)).balanceOf(solverAddress)
            nftId++
        } else if (buyTokensTransfers[i] === Commands.NFT_ERC1155_TRANSFER) {
            userBalanceAfter = await (await ethers.getContractAt("IERC1155", token)).balanceOf(receiver, buyNFTsIds[nftId])
            solverBalanceAfter = await (await ethers.getContractAt("IERC1155", token)).balanceOf(solverAddress, buyNFTsIds[nftId++])
        } else {
            userBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(receiver)
            solverBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(solverAddress)
            if (usingSolverContract &&
                !(sellTokensTransfers.includes(Commands.NFT_ERC721_TRANSFER) || sellTokensTransfers.includes(Commands.NFT_ERC1155_TRANSFER))){
                expect(solverBalanceAfter.sub(solverBalancesBefore[token])).to.be.equal(solverExcess)
            }
        }
        if (receiver === settlementAddr) {
            expect(userBalanceAfter.sub(userBalancesBefore[token])).to.be.equal(BigNumber.from(0))
        } else {
            expect(userBalanceAfter.sub(userBalancesBefore[token])).to.be.equal(BigNumber.from(amounts[i]).add(takerGetExcess ? solverExcess : 0))
        }
    }
}

export async function getBatchBalancesBefore(
    jamOrders: JamOrder.DataStruct[], batchBuyTokensTransfers: Commands[][], solverAddress: string
): Promise<{[id:string]: {[id:string]: BigNumberish}}> {
    // todo: allow verifying balances if taker has two reversed orders, e.g. USDC->WETH and WETH->USDC
    let allBalancesBefore: {[id:string]: {[id:string]: BigNumberish}} = {};
    for (let [i, order] of jamOrders.entries()){
        let [userBalancesBefore, _] = await getBalancesBefore(
            order.buyTokens, order.receiver, batchBuyTokensTransfers[i], order.buyNFTIds, solverAddress)
        if (allBalancesBefore[order.receiver] === undefined){
            allBalancesBefore[order.receiver] = {}
        }
        for (let [token, balance] of Object.entries(userBalancesBefore)){
            allBalancesBefore[order.receiver][token] = balance
        }
    }
    return allBalancesBefore
}

export async function batchVerifyBalancesAfter(
    solverAddress: string,
    settlementAddr: string,
    solverExcess: BigNumberish,
    allBalancesBefore: {[id:string]: {[id:string]: BigNumberish}},
    aggregatedAmounts: {[id: string]: {[id: string]: BigNumberish}},
    takerGetExcess: boolean = false
){
    // todo: add verification for other tokens types
    for (let [user, aggAmounts] of Object.entries(aggregatedAmounts)) {
        for (let [token, amount] of Object.entries(aggAmounts)) {
            let userBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(user)
            //let solverBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(solverAddress)

            if (user === settlementAddr) {
                expect(userBalanceAfter.sub(allBalancesBefore[user][token])).to.be.equal(BigNumber.from(0))
            } else {
                let delta = userBalanceAfter.sub(allBalancesBefore[user][token])
                let expectedDelta = BigNumber.from(amount).add(takerGetExcess ? solverExcess : 0);
                expect(expectedDelta.sub(delta)).to.be.lte(1)
            }
        }
    }
}


export function getBatchArrays(orders: JamOrder.DataStruct[], curFillPercents: BigNumberish[],takerExcess: BigNumberish): [BigNumberish[], string[], BigNumberish[], string] {
    let batchAmounts: BigNumberish[] = []
    let batchAddresses: string[] = []
    let batchNftIds: BigNumberish[] = []
    let batchTokenTransfers: string = "0x"
    for (let [ind, order] of orders.entries()) {
        for (let i=0; i < order.buyAmounts.length; i++) {
            batchAmounts.push(BigNumber.from(order.buyAmounts[i])
                .mul(curFillPercents.length === 0 ? 10000 : curFillPercents[ind]).div(10000).add(takerExcess))
        }

        batchAddresses.push(...order.buyTokens)
        batchNftIds.push(...order.buyNFTIds)
        batchTokenTransfers += order.buyTokenTransfers.toString().slice(2)
    }
    return [batchAmounts, batchAddresses, batchNftIds, batchTokenTransfers]

}

export function getAggregatedAmounts(orders: JamOrder.DataStruct[], fillPercents: BigNumberish[]): {[id: string]: {[id: string]: BigNumberish}}  {
    let takersTokensAmounts: {[id: string]: {[id: string]: BigNumberish}} = {}
    for (let [ind, order] of orders.entries()) {
        if (takersTokensAmounts[order.receiver] === undefined) {
            takersTokensAmounts[order.receiver] = {}
        }
        for (let i=0; i < order.buyTokens.length; i++) {
            if (takersTokensAmounts[order.receiver][order.buyTokens[i]] === undefined) {
                takersTokensAmounts[order.receiver][order.buyTokens[i]] = BigNumber.from(0)
            }
            takersTokensAmounts[order.receiver][order.buyTokens[i]] =
                BigNumber.from(takersTokensAmounts[order.receiver][order.buyTokens[i]])
                    .add(BigNumber.from(order.buyAmounts[i]).mul(fillPercents.length === 0 ? 10000 : fillPercents[ind]).div(10000))
        }
    }
    return takersTokensAmounts

}