// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

/// @title Commands
/// @notice Commands are used to specify how tokens are transferred in Data.buyTokenTransfers and Data.sellTokenTransfers
library Commands {
    bytes1 internal constant SIMPLE_TRANSFER = 0x00;
    bytes1 internal constant PERMIT2_TRANSFER = 0x01;
    bytes1 internal constant NATIVE_TRANSFER = 0x02;
    bytes1 internal constant NFT_ERC721_TRANSFER = 0x04;
    bytes1 internal constant NFT_ERC1155_TRANSFER = 0x05;
}

/// @title JamOrder
library JamOrder {

    address internal constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Data respresenting a Jam Order.
    struct Data {
        address taker;
        address receiver;
        uint32 expiry;
        uint256 nonce;
        bytes32 hooksHash; // keccak256(pre interactions + post interactions)
        address[] buyTokens;
        address[] sellTokens;
        uint256[] sellAmounts;
        uint256[] buyAmounts;
        uint256[] sellNFTIds;
        uint256[] buyNFTIds;
        bytes buyTokenTransfers; // Commands sequence of buyToken transfer types
        bytes sellTokenTransfers; // Commands sequence of sellToken transfer types
    }
}
