import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber, BigNumberish, utils} from "ethers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {NATIVE_TOKEN, TOKENS} from "../config";
import {JamHooks, JamOrderStruct} from "../../../typechain-types/artifacts/src/JamSettlement";
import {BlendAggregateOrderStruct} from "../../../typechain-types/artifacts/src/interfaces/IBebopBlend";
import {generateEventId, getEventId, getPartnerId} from "../blend/blendUtils";


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
    tokens: string[], address: string
) {
    let balancesBefore: {[id:string]: BigNumberish} = {}
    for (let [i, token] of tokens.entries()) {
        if (tokens[i] === NATIVE_TOKEN) {
            balancesBefore[token] = await ethers.provider.getBalance(address)
        } else {
            balancesBefore[token] = await (await ethers.getContractAt("IERC20", token)).balanceOf(address)
        }
    }
    return balancesBefore
}

export async function verifyBalancesAfter(
    tokens: string[],
    address: string,
    amounts: BigNumberish[],
    balancesBefore: {[id:string]: BigNumberish},
    accuracy: number = 0
) {
    for (let [i, token] of tokens.entries()) {
        let balanceAfter;
        if (tokens[i] === NATIVE_TOKEN) {
            balanceAfter = await ethers.provider.getBalance(address)
        } else {
            balanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(address)
        }
        if (accuracy === 0){
            expect(balanceAfter.sub(balancesBefore[token])).to.be.equal(BigNumber.from(amounts[i]))
        } else {
            expect(balanceAfter.sub(balancesBefore[token])).to.be.lte(BigNumber.from(amounts[i]).add(accuracy))
        }
    }
}

export async function getBatchBalancesBefore(
    jamOrders: JamOrderStruct[], partnerAddresses: string[]
): Promise<{[id:string]: {[id:string]: BigNumberish}}> {
    let allBalancesBefore: {[id:string]: {[id:string]: BigNumberish}} = {};
    for (let [i, order] of jamOrders.entries()){
        let userBalancesBefore= await getBalancesBefore(order.buyTokens, order.receiver)
        if (allBalancesBefore[order.receiver] === undefined){ allBalancesBefore[order.receiver] = {}}
        for (let [token, balance] of Object.entries(userBalancesBefore)){
            allBalancesBefore[order.receiver][token] = balance
        }
        for (let partner of partnerAddresses){
            let partnerBalancesBefore = await getBalancesBefore(order.buyTokens, partner)
            if (allBalancesBefore[partner] === undefined){ allBalancesBefore[partner] = {}}
            for (let [token, balance] of Object.entries(partnerBalancesBefore)){
                allBalancesBefore[partner][token] = balance
            }
        }
    }

    return allBalancesBefore
}

export async function batchVerifyBalancesAfter(
    allBalancesBefore: {[id:string]: {[id:string]: BigNumberish}},
    aggregatedAmounts: {[id: string]: {[id: string]: BigNumberish}},
){
    for (let [wallet, aggAmounts] of Object.entries(aggregatedAmounts)) {
        for (let [token, amount] of Object.entries(aggAmounts)) {
            let walletBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(wallet)
            //let solverBalanceAfter = await (await ethers.getContractAt("IERC20", token)).balanceOf(solverAddress)

            let delta = walletBalanceAfter.sub(allBalancesBefore[wallet][token])
            let expectedDelta = BigNumber.from(amount);
            expect(expectedDelta.sub(delta)).to.be.lte(1)
        }
    }
}


export function getBatchArrays(
    orders: JamOrderStruct[], takerExcess: BigNumberish, protocolFees: BigNumber[][] | undefined = undefined, partnerFees: BigNumber[][] | undefined = undefined
): [BigNumberish[], string[]] {
    let batchAmounts: BigNumberish[] = []
    let batchAddresses: string[] = []
    for (let [ind, order] of orders.entries()) {
        for (let i=0; i < order.buyAmounts.length; i++) {
            batchAmounts.push(BigNumber.from(order.buyAmounts[i]).add(takerExcess).add(protocolFees ? protocolFees[ind][i] : 0).add(partnerFees ? partnerFees[ind][i] : 0))
        }
        batchAddresses.push(...order.buyTokens)
    }
    return [batchAmounts, batchAddresses]

}

export function getAggregatedAmounts(
    orders: JamOrderStruct[]
): {[id: string]: {[id: string]: BigNumberish}}  {
    let takersTokensAmounts: {[id: string]: {[id: string]: BigNumberish}} = {}
    for (let [ind, order] of orders.entries()) {
        if (takersTokensAmounts[order.receiver] === undefined) {
            takersTokensAmounts[order.receiver] = {}
        }
        for (let i= 0; i < order.buyTokens.length; i++) {
            if (takersTokensAmounts[order.receiver][order.buyTokens[i]] === undefined) {
                takersTokensAmounts[order.receiver][order.buyTokens[i]] = BigNumber.from(0)
            }
            takersTokensAmounts[order.receiver][order.buyTokens[i]] =
                BigNumber.from(takersTokensAmounts[order.receiver][order.buyTokens[i]]).add(BigNumber.from(order.buyAmounts[i]));
        }
    }
    return takersTokensAmounts

}

export function addFeesAmounts(amounts: {[id: string]: {[id: string]: BigNumberish}}, orders: JamOrderStruct[], fees: BigNumber[][], receivers: string[]){
    for (let [ind, order] of orders.entries()) {
        if (amounts[receivers[ind]] === undefined) {
            amounts[receivers[ind]] = {}
        }
        for (let i= 0; i < order.buyTokens.length; i++) {
            if (amounts[receivers[ind]][order.buyTokens[i]] === undefined) {
                amounts[receivers[ind]][order.buyTokens[i]] = BigNumber.from(0)
            }
            amounts[receivers[ind]][order.buyTokens[i]] =
                BigNumber.from(amounts[receivers[ind]][order.buyTokens[i]]).add(BigNumber.from(fees[ind][i]));
        }
    }
}

export function encodeHooks(
    hooks: JamHooks.DefStruct
){
    return utils.defaultAbiCoder.encode(
        [
            "((bool,address,uint256,bytes)[],(bool,address,uint256,bytes)[])",
        ], [
            [hooks.beforeSettle.map(x => [x.result, x.to, x.value, x.data]), hooks.afterSettle.map(x => [x.result, x.to, x.value, x.data])]
        ]
    )
}

export function assertBlendAggregateEvent(
    eventArgs: any,
    order: BlendAggregateOrderStruct,
    sellTokens: string[],
    sellAmounts: Map<string, BigNumber>,
    buyTokens: string[],
    buyAmounts: Map<string, BigNumber>,
){
    expect(eventArgs.eventId).to.be.equal(getEventId(BigNumber.from(order.flags)))
    expect(eventArgs.receiver).to.be.equal(order.receiver)
    expect(eventArgs.sellTokens).to.be.deep.equal(sellTokens)
    expect(eventArgs.buyTokens).to.be.deep.equal(buyTokens)
    expect(eventArgs.sellAmounts).to.be.deep.equal(sellTokens.map(token => sellAmounts.get(token)))
    if (buyAmounts.has(NATIVE_TOKEN)){
        buyAmounts.set(TOKENS.WETH, buyAmounts.get(NATIVE_TOKEN)!)
    }
    expect(eventArgs.buyAmounts).to.be.deep.equal(buyTokens.map(token => buyAmounts.get(token)))
}

export function generatePartnerInfo(partnerAddress: string, partnerFeeBps: number, protocolFeeBps: number) {
    return BigNumber.from(partnerAddress).shl(32).or(BigNumber.from(partnerFeeBps).shl(16)).or(BigNumber.from(protocolFeeBps))
}

export function createFakeJamOrder(jamOrder: JamOrderStruct, ind: number): JamOrderStruct {
    let fakeOrder = {...jamOrder}
    fakeOrder.buyTokens = [fakeOrder.buyTokens[ind]]
    fakeOrder.buyAmounts = [fakeOrder.buyAmounts[ind]]
    fakeOrder.sellTokens = [fakeOrder.sellTokens[ind]]
    fakeOrder.sellAmounts = [fakeOrder.sellAmounts[ind]]
    return fakeOrder
}