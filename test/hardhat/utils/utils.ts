import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement, Signature} from "../../../typechain-types/artifacts/src/JamSettlement";
import {BigNumber, BigNumberish, BytesLike, Contract, Signer} from "ethers";
import {Commands} from "./jamOrders";
import {ethers} from "hardhat";
import {expect} from "chai";
import {NATIVE_TOKEN, PERMIT2_ADDRESS, TOKENS} from "../config";


export function generateExpiry(){
    return Math.floor(Date.now() / 1000) + 1000;
}

export async function approveTokens(
    tokens: string[], amounts: BigNumberish[], user: SignerWithAddress, spender: string
): Promise<BigNumber> {
    let nativeTokenAmount = BigNumber.from(0)
    for (let i = 0; i < tokens.length; i++) {
        let curTokenContract = await ethers.getContractAt("IERC20", tokens[i])
        if (tokens[i] === NATIVE_TOKEN) {
            nativeTokenAmount = nativeTokenAmount.add(BigNumber.from(amounts[i]))
        } else {
            await curTokenContract.connect(user).approve(spender, amounts[i]);
        }
    }
    return nativeTokenAmount
}

export async function getBalancesBefore(
    tokens: string[], receiver: string, solverAddress: string
) {
    let userBalancesBefore: {[id:string]: BigNumberish} = {}
    let solverBalancesBefore: {[id:string]: BigNumberish} = {}
    for (let [i, token] of tokens.entries()) {
        if (tokens[i] === NATIVE_TOKEN) {
            userBalancesBefore[token] = await ethers.provider.getBalance(receiver)
            solverBalancesBefore[token] = await ethers.provider.getBalance(solverAddress)
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
    for (let [i, token] of tokens.entries()) {
        let userBalanceAfter;
        let solverBalanceAfter;

        if (tokens[i] === NATIVE_TOKEN) {
            userBalanceAfter = await ethers.provider.getBalance(receiver)
            solverBalanceAfter = await ethers.provider.getBalance(solverAddress)
        } else {
            userBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(receiver)
            solverBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(solverAddress)
            if (usingSolverContract){
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
    jamOrders: JamOrder.DataStruct[], solverAddress: string
): Promise<{[id:string]: {[id:string]: BigNumberish}}> {
    // todo: allow verifying balances if taker has two reversed orders, e.g. USDC->WETH and WETH->USDC
    let allBalancesBefore: {[id:string]: {[id:string]: BigNumberish}} = {};
    for (let [i, order] of jamOrders.entries()){
        let [userBalancesBefore, _] = await getBalancesBefore(
            order.buyTokens, order.receiver, solverAddress)
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