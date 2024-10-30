import {ethers} from "hardhat";
import {BigNumber, BigNumberish} from "ethers";
import {
    BlendAggregateOrderStruct, BlendMultiOrderStruct,
    BlendSingleOrderStruct
} from "../../../typechain-types/artifacts/src/interfaces/IBebopBlend";


interface PartnerInfo {
    id: number,
    fee: number
    beneficiary: string
}
const NO_PARTNER: PartnerInfo = {
    id: 0,
    fee: 0,
    beneficiary: ethers.constants.AddressZero
}

enum SignatureType {
    EIP712,
    EIP1271,
    ETHSIGN
}

export enum BlendCommand {
    SIMPLE_TRANSFER = "00",
    PERMIT2_TRANSFER ="01",
    CALL_PERMIT_THEN_TRANSFER = "02",
    CALL_PERMIT2_THEN_TRANSFER = "03",
    NATIVE_TRANSFER = "04",
    TRANSFER_TO_CONTRACT = "07",
    TRANSFER_FROM_CONTRACT = "08",
}

export function generateEventId(extraInfo: number): BigNumber{
    const maxUint128 = BigNumber.from(2).pow(128).sub(1)
    let randomInt = ethers.BigNumber.from(ethers.utils.randomBytes(32)).mod(maxUint128)
    return randomInt.div(100).mul(100).add(extraInfo)
}

export function generateSingleOrderCommands(takerTransferType: BlendCommand, makerTransferType: BlendCommand) {
    let flags = 0
    if (takerTransferType === BlendCommand.NATIVE_TRANSFER) {
        flags = flags | 1
    }
    if (makerTransferType === BlendCommand.NATIVE_TRANSFER){
        flags = flags | 2
    }
    if (takerTransferType === BlendCommand.PERMIT2_TRANSFER) {
        flags = flags | 4
    }
    return flags
}

export function generateMakerFlags(signatureType: SignatureType, makerUsingPermit2: boolean) {
    let flags = 0
    if (signatureType === SignatureType.EIP1271) {
        flags = flags | 1
    }
    if (signatureType === SignatureType.ETHSIGN) {
        flags = flags | 2
    }
    if (makerUsingPermit2) {
        flags = flags | 4
    }
    return flags
}

export function generateTakerFlags(signatureType: SignatureType, partnerId: number) {
    let someExtraInfo = 77 //0..99
    let flags = generateEventId(someExtraInfo)
    flags = flags.shl(128)

    if (partnerId > 0){
        flags = flags.or(ethers.BigNumber.from(partnerId).shl(64))
    }

    if (signatureType === SignatureType.EIP1271) {
        flags = flags.or(1)
    }
    if (signatureType === SignatureType.ETHSIGN) {
        flags = flags.or(2)
    }
    console.assert(someExtraInfo === getEventId(flags).mod(100).toNumber(), "someExtraInfo is not equal")
    console.assert(partnerId === getPartnerId(flags).toNumber(), "partnerId is not equal")
    return flags
}

export function getEventId(flags: BigNumber): BigNumber {
    return flags.shr(128)
}

export function getPartnerId(flags: BigNumber): BigNumber {
    return flags.shr(64).and(ethers.BigNumber.from(2).pow(64).sub(1))
}

export function getSingleOrder(
    takerToken: string,
    makerToken: string,
    takerAmount: BigNumberish,
    makerAmount: BigNumberish,
    takerAddress: string,
    makerAddress: string,
    takerTransferType: BlendCommand,
    makerTransferType: BlendCommand,
    takerSignatureType: SignatureType = SignatureType.EIP712,
    partnerId: number = 0,
    _expiry: number | undefined = undefined
): BlendSingleOrderStruct {
    let expiry = _expiry === undefined ? Math.floor(Date.now() / 1000) + 1000 : _expiry;
    let maker_nonce = Math.floor(Math.random() * 1000000);
    return {
        taker_token: takerToken,
        maker_token: makerToken,
        taker_amount: takerAmount,
        maker_amount: makerAmount,
        taker_address: takerAddress,
        maker_address: makerAddress,
        receiver: takerAddress,
        maker_nonce,
        expiry,
        packed_commands: generateSingleOrderCommands(takerTransferType, makerTransferType),
        flags: generateTakerFlags(takerSignatureType, partnerId).toString()
    }
}

export function getMultiOrder(
    takerTokens: string[],
    makerTokens: string[],
    takerAmounts: BigNumberish[],
    makerAmounts: BigNumberish[],
    takerAddress: string,
    makerAddress: string,
    takerTransferType: BlendCommand[],
    makerTransferType: BlendCommand[],
    takerSignatureType: SignatureType = SignatureType.EIP712,
    partnerId: number = 0,
    _expiry: number | undefined = undefined
): BlendMultiOrderStruct {
    let expiry = _expiry === undefined ? Math.floor(Date.now() / 1000) + 1000 : _expiry;
    let maker_nonce = Math.floor(Math.random() * 1000000);
    return {
        taker_tokens: takerTokens,
        maker_tokens: makerTokens,
        taker_amounts: takerAmounts,
        maker_amounts: makerAmounts,
        taker_address: takerAddress,
        maker_address: makerAddress,
        receiver: takerAddress,
        maker_nonce,
        expiry,
        commands: "0x" + makerTransferType.join('') + takerTransferType.join(''),
        flags: generateTakerFlags(takerSignatureType, partnerId).toString()
    }
}

export function getCommandsString(takerTransfersTypes: BlendCommand[][], makerTransfersTypes: BlendCommand[][]) {
    let commands = "0x"
    for (let i = 0; i < makerTransfersTypes.length; i++) {
        commands += makerTransfersTypes[i].join('')
        commands += takerTransfersTypes[i].join('')
    }
    return commands
}

export function getMakerOrderFromAggregate(
    _order: BlendAggregateOrderStruct, makerIndex: number, takerTransfersTypes: BlendCommand[][], makerTransfersTypes: BlendCommand[][]
): BlendMultiOrderStruct{
    return {
        expiry: _order.expiry,
        taker_address: _order.taker_address,
        maker_address: (_order as BlendAggregateOrderStruct).maker_addresses[makerIndex],
        maker_nonce: (_order as BlendAggregateOrderStruct).maker_nonces[makerIndex],
        taker_tokens: (_order as BlendAggregateOrderStruct).taker_tokens[makerIndex],
        maker_tokens: (_order as BlendAggregateOrderStruct).maker_tokens[makerIndex],
        taker_amounts: (_order as BlendAggregateOrderStruct).taker_amounts[makerIndex],
        maker_amounts: (_order as BlendAggregateOrderStruct).maker_amounts[makerIndex],
        receiver: _order.receiver,
        commands: "0x"+makerTransfersTypes[makerIndex].join('')+takerTransfersTypes[makerIndex].join(''),
        flags: 0
    }
}

export function getTakerUniqueTokensForAggregate(
    order: BlendAggregateOrderStruct, takerTransfersTypes: BlendCommand[][]
): [string[], Map<string, BigNumber>] {
    let tokens = new Map<string, BigNumber>()
    let uniqueTokens: string[] = []
    for (let [i, tokensArray] of order.taker_tokens.entries()) {
        for (let [j, token] of tokensArray.entries()) {
            if (takerTransfersTypes[i][j] == BlendCommand.TRANSFER_FROM_CONTRACT) {
                continue
            }
            if (tokens.has(token)) {
                tokens.set(token, tokens.get(token)!.add(BigNumber.from(order.taker_amounts[i][j])))
            } else {
                uniqueTokens.push(token)
                tokens.set(token, BigNumber.from(order.taker_amounts[i][j]))
            }
        }
    }
    return [uniqueTokens, tokens]
}

export function getMakerUniqueTokensForAggregate(
    order: BlendAggregateOrderStruct, makerTransfersTypes: BlendCommand[][], maker_amounts: BigNumberish[][]
): [string[], Map<string, BigNumber>] {
    let tokens = new Map<string, BigNumber>()
    let uniqueTokens: string[] = []
    for (let i = 0; i < order.maker_tokens.length; i+=1) {
        for (let [j, token] of order.maker_tokens[i].entries()) {
            if (makerTransfersTypes[i][j] == BlendCommand.TRANSFER_TO_CONTRACT) {
                continue
            }
            if (tokens.has(token)) {
                tokens.set(token, tokens.get(token)!.add(maker_amounts[i][j]))
            } else {
                uniqueTokens.push(token)
                tokens.set(token, BigNumber.from(maker_amounts[i][j]))
            }
        }
    }
    return [uniqueTokens, tokens]
}