import {PermitBatch, PermitDetails} from "@uniswap/permit2-sdk/dist/allowanceTransfer";
import {AllowanceTransfer, MaxUint160} from "@uniswap/permit2-sdk";
import {BigNumberish, Contract, ethers, Signer} from "ethers";
import Permit2 from "./abi/Permit2.json";
import Wrapped from "./abi/Wrapped.json";
import {TypedDataSigner} from "@ethersproject/abstract-signer/src.ts";
import {chainConstants, permit2Address} from "./hooksConstants";


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


    async getHook_wrapNative(amount: BigNumberish){
        await this.prepareData()
        let wrappedTokenContract = new Contract(chainConstants[this.chainId!].wrappedToken, Wrapped, this.user)
        return await wrappedTokenContract.populateTransaction["deposit()"]({value: amount})
    }

}