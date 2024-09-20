// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../interfaces/IPermit2.sol";


/// @notice Struct for any trade with multiple makers
struct BlendAggregateOrder {
    uint256 expiry;
    address taker_address;
    address[] maker_addresses;
    uint256[] maker_nonces;
    address[][] taker_tokens;
    address[][] maker_tokens;
    uint256[][] taker_amounts;
    uint256[][] maker_amounts;
    address receiver;
    bytes commands;
    uint256 flags;
}


library BlendAggregateOrderLib {

    bytes internal constant ORDER_TYPE = abi.encodePacked(
        "AggregateOrder(uint64 partner_id,uint256 expiry,address taker_address,address[] maker_addresses,uint256[] maker_nonces,address[][] taker_tokens,address[][] maker_tokens,uint256[][] taker_amounts,uint256[][] maker_amounts,address receiver,bytes commands)"
    );
    bytes32 internal constant ORDER_TYPE_HASH = keccak256(ORDER_TYPE);
    string internal constant PERMIT2_ORDER_TYPE = string(
        abi.encodePacked("AggregateOrder witness)", ORDER_TYPE, "TokenPermissions(address token,uint256 amount)")
    );

    /// @notice hash the given order using same schema as in BebopBlend contract
    /// @param order the order to hash
    /// @param updatedMakerAmounts amounts that taker signed
    /// @param updatedMakerNonces nonce that taker signed
    /// @return the eip-712 order hash
    function hash(
        BlendAggregateOrder memory order, uint256[][] memory updatedMakerAmounts, uint256[] memory updatedMakerNonces
    ) internal pure returns (bytes32) {
        uint64 partnerId = uint64(order.flags >> 64);
        return keccak256(
            abi.encode(
                ORDER_TYPE_HASH, partnerId, order.expiry, order.taker_address,
                keccak256(abi.encodePacked(order.maker_addresses)), keccak256(abi.encodePacked(updatedMakerNonces)),
                keccak256(_encodeTightlyPackedNested(order.taker_tokens)), keccak256(_encodeTightlyPackedNested(order.maker_tokens)),
                keccak256(_encodeTightlyPackedNestedInt(order.taker_amounts)), keccak256(_encodeTightlyPackedNestedInt(updatedMakerAmounts)),
                order.receiver, keccak256(order.commands)
            )
        );
    }

    function toBatchPermit2(
        BlendAggregateOrder memory order, address[] memory tokens, uint256[] memory amounts
    ) internal pure returns (IPermit2.PermitBatchTransferFrom memory) {
        IPermit2.TokenPermissions[] memory permitted = new IPermit2.TokenPermissions[](tokens.length);
        for (uint i; i < tokens.length; ++i) {
            permitted[i] = IPermit2.TokenPermissions(tokens[i], amounts[i]);
        }
        return IPermit2.PermitBatchTransferFrom(permitted, order.flags >> 128, order.expiry);
    }

    function toSignatureTransferDetails(
        uint256[] memory amounts, address receiver
    ) internal pure returns (IPermit2.SignatureTransferDetails[] memory) {
        IPermit2.SignatureTransferDetails[] memory details = new IPermit2.SignatureTransferDetails[](amounts.length);
        for (uint i; i < amounts.length; ++i) {
            details[i] = IPermit2.SignatureTransferDetails(receiver, amounts[i]);
        }
        return details;
    }

    function unpackTokensAndAmounts(
        BlendAggregateOrder memory order
    ) internal pure returns (address[] memory tokens, uint256[] memory amounts){
        uint maxLen;
        for (uint i; i < order.taker_tokens.length; ++i) {
            maxLen += order.taker_tokens[i].length;
        }
        tokens = new address[](maxLen);
        amounts = new uint256[](maxLen);
        uint uniqueTokensCnt;
        uint commandsInd;
        for (uint256 i; i < order.taker_tokens.length; ++i) {
            commandsInd += order.maker_tokens[i].length;
            for (uint256 j; j < order.taker_tokens[i].length; ++j) {
                if (order.commands[commandsInd + j] != 0x08) {  // Commands.TRANSFER_FROM_CONTRACT=0x08
                    bool isNew = true;
                    for (uint256 k; k < uniqueTokensCnt; ++k) {
                        if (tokens[k] == order.taker_tokens[i][j]) {
                            amounts[k] += order.taker_amounts[i][j];
                            isNew = false;
                            break;
                        }
                    }
                    if (isNew) {
                        tokens[uniqueTokensCnt] = order.taker_tokens[i][j];
                        amounts[uniqueTokensCnt++] = order.taker_amounts[i][j];
                    }
                }
            }
            commandsInd += order.taker_tokens[i].length;
        }
        assembly {
            mstore(tokens, uniqueTokensCnt)
            mstore(amounts, uniqueTokensCnt)
        }
    }

    /// @notice Pack 2D array of integers into tightly packed bytes for hashing
    function _encodeTightlyPackedNestedInt(uint256[][] memory nestedArray) private pure returns (bytes memory encoded) {
        uint nestedArrayLen = nestedArray.length;
        for (uint i; i < nestedArrayLen; ++i) {
            encoded = abi.encodePacked(encoded, keccak256(abi.encodePacked(nestedArray[i])));
        }
        return encoded;
    }

    /// @notice Pack 2D array of addresses into tightly packed bytes for hashing
    function _encodeTightlyPackedNested(address[][] memory nestedArray) private pure returns (bytes memory encoded) {
        uint nestedArrayLen = nestedArray.length;
        for (uint i; i < nestedArrayLen; ++i) {
            encoded = abi.encodePacked(encoded, keccak256(abi.encodePacked(nestedArray[i])));
        }
        return encoded;
    }

}
