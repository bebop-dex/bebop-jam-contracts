import {PermitBatch, PermitDetails} from "@uniswap/permit2-sdk/dist/allowanceTransfer";
import {AllowanceTransfer, MaxUint160, MaxUint256} from "@uniswap/permit2-sdk";
import {BigNumberish, Contract, ethers, Signer} from "ethers";
import Permit2 from "./abi/Permit2.json";
import Wrapped from "./abi/Wrapped.json";
import ERC20 from "./abi/ERC20.json";
import {TypedDataSigner} from "@ethersproject/abstract-signer/src.ts";
import {chainConstants, permit2Address} from "./hooksConstants";
import {Eip2612PermitUtils, ProviderConnector} from "@1inch/permit-signed-approvals-utils"
import {UserConnector} from "./connector";
import {DaiPermitParams, PermitParams} from "@1inch/permit-signed-approvals-utils/model/permit.model";



export class HooksGenerator {

    user: Signer & TypedDataSigner;
    userAddress: string | null = null;
    chainId: number | null = null;
    permit2Contract: Contract;

    constructor(user: Signer & TypedDataSigner) {
        this.user = user
        this.permit2Contract = new Contract(permit2Address, Permit2, user)
        user.getAddress().then((address) => {
            this.userAddress = address
        })
        user.getChainId().then((chainId) => {
            this.chainId = chainId
        })
    }

    private async prepareData(){
        if (this.userAddress == null) {
            this.userAddress = await this.user.getAddress()
        }
        if (this.chainId == null) {
            this.chainId = await this.user.getChainId()
        }
    }

    async getHook_Permit2(tokenAddresses: string[], spender: string, deadline: number | null = null){
        await this.prepareData()
        if (deadline == null) {
            deadline = Math.round(Date.now() / 1000) + 12000
        }
        let tokenDetails: PermitDetails[] = []
        for (let i = 0; i < tokenAddresses.length; i++) {
            tokenDetails.push({
                token: tokenAddresses[i],
                amount: MaxUint160,
                expiration: deadline.toString(),
                nonce: (await this.permit2Contract.allowance(this.userAddress, tokenAddresses[i], spender)).nonce
            })
        }

        let msgPermit2: PermitBatch = {
            details: tokenDetails,
            spender: spender,
            sigDeadline: deadline
        }
        let permitMsgTyped = AllowanceTransfer.getPermitData(msgPermit2, this.permit2Contract.address, this.chainId!)
        const { domain, types, values } = permitMsgTyped
        let signature = await this.user._signTypedData(domain, types, values)

        return await this.permit2Contract.populateTransaction[
            "permit(address,((address,uint160,uint48,uint48)[],address,uint256),bytes)"
            ](this.user.getAddress(), msgPermit2, signature)
    }

    async getHook_Permit(tokenAddress: string, spender: string, deadline: number | null = null) {
        await this.prepareData()
        if (deadline == null) {
            deadline = Math.round(Date.now() / 1000) + 12000
        }
        let connector: ProviderConnector = new UserConnector(this.user)
        const eip2612PermitUtils = new Eip2612PermitUtils(connector);
        const tokenContract = new Contract(tokenAddress, ERC20, this.user)
        let tokenName = await tokenContract.name()
        let version = await tokenContract.version()
        let nonce = await eip2612PermitUtils.getTokenNonce(
            tokenAddress,
            this.userAddress!,
        );
        let signature;
        if (tokenAddress.toLowerCase() === chainConstants[this.chainId!].dai.toLowerCase()) {
            let permit: DaiPermitParams = {
                holder: this.userAddress!,
                spender: spender,
                nonce: nonce,
                expiry: deadline,
                allowed: true
            }
            signature = await eip2612PermitUtils.buildDaiLikePermitSignature(permit, this.chainId!, tokenName, tokenAddress, version)
            let expanded = ethers.utils.splitSignature(signature);
            return await tokenContract.populateTransaction[
                "permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)"
                ](permit.holder, permit.spender, permit.nonce, permit.expiry, true, expanded.v, expanded.r, expanded.s)
        } else {
            let permit: PermitParams = {
                owner: this.userAddress!,
                spender: spender,
                value: MaxUint256.toString(),
                nonce: nonce,
                deadline: deadline
            }
            signature = await eip2612PermitUtils.buildPermitSignature(permit, this.chainId!, tokenName, tokenAddress, version)
            let expanded = ethers.utils.splitSignature(signature);
            return await tokenContract.populateTransaction[
               "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
                ](permit.owner, permit.spender, permit.value, permit.deadline, expanded.v, expanded.r, expanded.s)
        }
    }

    async getHook_wrapNative(amount: BigNumberish){
        await this.prepareData()
        let wrappedTokenContract = new Contract(chainConstants[this.chainId!].wrappedToken, Wrapped, this.user)
        return await wrappedTokenContract.populateTransaction["deposit()"]({value: amount})
    }

    async getHook_unwrap(amount: BigNumberish){
        await this.prepareData()
        let wrappedTokenContract = new Contract(chainConstants[this.chainId!].wrappedToken, Wrapped, this.user)
        return await wrappedTokenContract.populateTransaction["withdraw(uint256)"](amount)
    }

}