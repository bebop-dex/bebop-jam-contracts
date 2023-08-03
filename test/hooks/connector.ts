import {AbiInput, AbiItem, EIP712TypedData, ProviderConnector} from "@1inch/permit-signed-approvals-utils";
import {Contract, ethers, Signer} from "ethers";
import {TypedDataSigner} from "@ethersproject/abstract-signer/src.ts";

export class UserConnector implements ProviderConnector {

    user: Signer & TypedDataSigner;

    constructor(user: Signer & TypedDataSigner) {
        this.user = user
    }
    contractEncodeABI(abi: AbiItem[], address: string | null, methodName: string, methodParams: unknown[]): string {
        let contract = new Contract(address!, abi, this.user)
        return contract.interface.encodeFunctionData(methodName, methodParams)
    }

    decodeABIParameter<T>(type: string, hex: string): T {
        return ethers.utils.defaultAbiCoder.decode([type], hex)[0] as T;
    }

    decodeABIParameters<T>(types: AbiInput[], hex: string): T {
        return ethers.utils.defaultAbiCoder.decode(types.map(x => x.name), hex)[0] as T
    }

    ethCall(contractAddress: string, callData: string): Promise<string> {
        return this.user.call({to: contractAddress, data: callData});
    }

    signTypedData(walletAddress: string, typedData: EIP712TypedData, typedDataHash: string): Promise<string> {
        return this.user._signTypedData(typedData.domain, {Permit: typedData.types.Permit}, typedData.message)
    }
}