import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement, Signature} from "../../typechain-types/artifacts/src/JamSettlement";
import {BigNumber, BigNumberish} from "ethers";
import {Commands} from "./orders";
import {ethers} from "hardhat";
import {expect} from "chai";
import {NFTS_ERC1155} from "../config";

export enum SolverContractType {
    NONE,
    ERC20,
    ERC721,
    ERC1155
}

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

export async function getBalancesBefore(tokens: string[], receiver: string, buyTokensTransfers: Commands[], solverAddress: string, solverContractType: SolverContractType) {
    let userBalancesBefore: {[id:string]: BigNumberish} = {}
    let solverBalancesBefore: {[id:string]: BigNumberish} = {}
    for (let [i, token] of tokens.entries()) {
        if (buyTokensTransfers[i] === Commands.NATIVE_TRANSFER || buyTokensTransfers[i] === Commands.UNWRAP_AND_TRANSFER) {
            userBalancesBefore[token] = await ethers.provider.getBalance(receiver)
        } else {
            if (solverContractType === SolverContractType.ERC1155) {
                userBalancesBefore[token] = await (await ethers.getContractAt("IERC1155", token)).balanceOf(receiver, NFTS_ERC1155.opensea.id)
            } else {
                userBalancesBefore[token] = await (await ethers.getContractAt("ERC20", token)).balanceOf(receiver)
            }
        }
        if (solverContractType !== SolverContractType.ERC1155 && solverContractType !== SolverContractType.ERC721) {
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
    solverAddress: string,
    solverContractType: SolverContractType,
    amounts: BigNumberish[],
    solverExcess: BigNumberish,
    userBalancesBefore: {[id:string]: BigNumberish},
    solverBalancesBefore: {[id:string]: BigNumberish},
){
    let usingSolverContract = solverContractType !== SolverContractType.NONE
    for (let [i, token] of tokens.entries()) {
        let userBalanceAfter;
        if (buyTokensTransfers[i] === Commands.NATIVE_TRANSFER || buyTokensTransfers[i] === Commands.UNWRAP_AND_TRANSFER) {
            userBalanceAfter = await ethers.provider.getBalance(receiver)
        } else {
            if (solverContractType === SolverContractType.ERC1155) {
                userBalanceAfter = await (await ethers.getContractAt("IERC1155", token)).balanceOf(receiver, NFTS_ERC1155.opensea.id)
            } else {
                userBalanceAfter = await (await ethers.getContractAt("ERC20", token)).balanceOf(receiver)
            }
        }
        expect(userBalanceAfter.sub(userBalancesBefore[token])).to.be.equal(BigNumber.from(amounts[i]).add(usingSolverContract ? 0 : solverExcess))
        if (!sellTokensTransfers.includes(Commands.NFT_ERC721_TRANSFER) && !sellTokensTransfers.includes(Commands.NFT_ERC1155_TRANSFER) &&
            solverContractType !== SolverContractType.ERC721 && solverContractType !== SolverContractType.ERC1155) {
            let solverBalanceAfter = await (await ethers.getContractAt("ERC20", token)).balanceOf(solverAddress)
            expect(solverBalanceAfter.sub(solverBalancesBefore[token])).to.be.equal(usingSolverContract ? solverExcess : 0) // solver excess
        }
    }
}