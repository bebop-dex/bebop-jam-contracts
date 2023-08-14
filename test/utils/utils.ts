import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement, Signature} from "../../typechain-types/artifacts/src/JamSettlement";
import {BigNumber, BigNumberish} from "ethers";
import {Commands} from "./orders";
import {ethers} from "hardhat";
import {expect} from "chai";
import {NFTS_ERC1155, PERMIT2_ADDRESS} from "../config";
import {token} from "../../typechain-types/artifacts/lib/openzeppelin-contracts/contracts";

const JAM_ORDER_TYPES = {
    "JamOrder": [
        { "name": "taker", "type": "address" },
        { "name": "receiver", "type": "address" },
        { "name": "expiry", "type": "uint32" },
        { "name": "nonce", "type": "uint256" },
        { "name": "hooksHash", "type": "bytes32" },
        { "name": "buyTokens", "type": "address[]" },
        { "name": "sellTokens", "type": "address[]" },
        { "name": "buyAmounts", "type": "uint256[]" },
        { "name": "sellAmounts", "type": "uint256[]" },
    ]
}

export async function signJamOrder(user: SignerWithAddress, order: JamOrder.DataStruct, settlement: JamSettlement) {
    const JAM_DOMAIN = {
        "name": "JamSettlement",
        "version": "1",
        "chainId": await user.getChainId(),
        "verifyingContract": settlement.address
    }

    const signatureBytes = await user._signTypedData(JAM_DOMAIN, JAM_ORDER_TYPES, order);
    const signature: Signature.TypedSignatureStruct = {
        signatureType: 1,
        signatureBytes: signatureBytes
    }

    return signature
}


export async function approveTokens(
    tokens: string[], amounts: BigNumberish[], tokenTransfers: Commands[], user: SignerWithAddress, spender: string
): Promise<BigNumber> {
    let nativeTokenAmount = BigNumber.from(0)
    for (let i = 0; i < tokens.length; i++) {
        let curTokenContract = await ethers.getContractAt("ERC20", tokens[i])
        if (tokenTransfers[i] === Commands.SIMPLE_TRANSFER) {
            await curTokenContract.connect(user).approve(spender, amounts[i]);
        } else if (tokenTransfers[i] === Commands.PERMIT2_TRANSFER) {
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
            userBalancesBefore[token] = await (await ethers.getContractAt("ERC20", token)).balanceOf(receiver)
            solverBalancesBefore[token] = await (await ethers.getContractAt("ERC20", token)).balanceOf(solverAddress)
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
    internalSettle: boolean
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
            userBalanceAfter = await (await ethers.getContractAt("ERC20", token)).balanceOf(receiver)
            solverBalanceAfter = await (await ethers.getContractAt("ERC20", token)).balanceOf(solverAddress)
            if (usingSolverContract &&
                !(sellTokensTransfers.includes(Commands.NFT_ERC721_TRANSFER) || sellTokensTransfers.includes(Commands.NFT_ERC1155_TRANSFER))){
                expect(solverBalanceAfter.sub(solverBalancesBefore[token])).to.be.equal(solverExcess)
            }
        }
        expect(userBalanceAfter.sub(userBalancesBefore[token])).to.be.equal(BigNumber.from(amounts[i]).add(takerGetExcess ? solverExcess : 0))
    }
}