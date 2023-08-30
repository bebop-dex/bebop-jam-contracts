import {PermitBatch, PermitDetails} from "@uniswap/permit2-sdk/dist/allowanceTransfer";
import {AllowanceTransfer, MaxUint160, MaxUint256} from "@uniswap/permit2-sdk";
import {Contract, ethers, Signer} from "ethers";
import Permit2 from "../hooks/abi/Permit2.json";
import {TypedDataSigner} from "@ethersproject/abstract-signer/src.ts";
import {Signature} from "../../typechain-types/test/bebop/BebopSettlement";
import {PERMIT2_ADDRESS} from "../config";
import {Eip2612PermitUtils, ProviderConnector} from "@1inch/permit-signed-approvals-utils";
import {UserConnector} from "../hooks/connector";
import ERC20 from "../hooks/abi/ERC20.json";
import {chainConstants} from "../hooks/hooksConstants";
import {DaiPermitParams, PermitParams} from "@1inch/permit-signed-approvals-utils/model/permit.model";


export async function signPermit2(user: Signer & TypedDataSigner, tokenAddresses: string[], spender: string, deadline: number): Promise<Signature.TakerPermitsInfoStruct>{
    let permit2Contract: Contract = new Contract(PERMIT2_ADDRESS, Permit2, user)
    let userAddress: string = await user.getAddress()
    let chainId: number = await user.getChainId()

    let tokenDetails: PermitDetails[] = []
    for (let i = 0; i < tokenAddresses.length; i++) {
        tokenDetails.push({
            token: tokenAddresses[i],
            amount: MaxUint160,
            expiration: deadline.toString(),
            nonce: (await permit2Contract.allowance(userAddress, tokenAddresses[i], spender)).nonce
        })
    }

    let msgPermit2: PermitBatch = {
        details: tokenDetails,
        spender: spender,
        sigDeadline: deadline
    }
    let permitMsgTyped = AllowanceTransfer.getPermitData(msgPermit2, permit2Contract.address, chainId!)
    const { domain, types, values } = permitMsgTyped
    let signature = await user._signTypedData(domain, types, values)
    return {
        permitSignatures: [],
        noncesPermit2: tokenDetails.map((detail) => detail.nonce),
        signatureBytesPermit2: signature,
        deadline: deadline
    }
}

export async function signPermit(user: Signer & TypedDataSigner, tokenAddress: string, spender: string, deadline: number) : Promise<Signature.TakerPermitsInfoStruct>{
    let userAddress: string = await user.getAddress()
    let chainId: number = await user.getChainId()

    let connector: ProviderConnector = new UserConnector(user)
    const eip2612PermitUtils = new Eip2612PermitUtils(connector);
    const tokenContract = new Contract(tokenAddress, ERC20, user)
    let tokenName = await tokenContract.name()

    let version: string | undefined
    try {
        version = await tokenContract.version()
    } catch (e){ version = undefined }
    let nonce: number
    try {
        nonce = await eip2612PermitUtils.getTokenNonce(
            tokenAddress,
            userAddress,
        );
    } catch (e) { nonce = 0 }

    let signature;
    if (tokenAddress.toLowerCase() === chainConstants[chainId].dai.toLowerCase()) {
        let permit: DaiPermitParams = {
            holder: userAddress,
            spender: spender,
            nonce: nonce,
            expiry: deadline,
            allowed: true
        }
        signature = await eip2612PermitUtils.buildDaiLikePermitSignature(permit, chainId, tokenName, tokenAddress, version)
    } else {
        let permit: PermitParams = {
            owner: userAddress,
            spender: spender,
            value: MaxUint256.toString(),
            nonce: nonce,
            deadline: deadline
        }
        signature = await eip2612PermitUtils.buildPermitSignature(permit, chainId, tokenName, tokenAddress, version)
    }
    return {
        permitSignatures: [signature],
        noncesPermit2: [],
        signatureBytesPermit2: "0x",
        deadline: deadline
    }
}