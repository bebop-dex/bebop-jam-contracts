import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JamOrder, JamSettlement, Signature} from "../../typechain-types/artifacts/src/JamSettlement";

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