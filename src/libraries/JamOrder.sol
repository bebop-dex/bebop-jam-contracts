// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../interfaces/IPermit2.sol";
import "../libraries/common/BMath.sol";

/// @title Commands
/// @notice Commands are used to specify how tokens are transferred in Data.buyTokenTransfers and Data.sellTokenTransfers
library Commands {
    bytes1 internal constant SIMPLE_TRANSFER = 0x00; // simple transfer with standard transferFrom
    bytes1 internal constant PERMIT2_TRANSFER = 0x01; // transfer using permit2.transfer
    bytes1 internal constant CALL_PERMIT_THEN_TRANSFER = 0x02; // call permit then simple transfer
    bytes1 internal constant CALL_PERMIT2_THEN_TRANSFER = 0x03; // call permit2.permit then permit2.transfer
    bytes1 internal constant NATIVE_TRANSFER = 0x04;
    bytes1 internal constant NFT_ERC721_TRANSFER = 0x05;
    bytes1 internal constant NFT_ERC1155_TRANSFER = 0x06;
}

/// @title JamOrder
library JamOrder {

    address internal constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Data representing a Jam Order.
    struct Data {
        address taker;
        address receiver;
        uint256 expiry;
        uint256 nonce;
        address executor; // only msg.sender=executor is allowed to execute (if executor=address(0), then order can be executed by anyone)
        uint16 minFillPercent; // 100% = 10000, if taker allows partial fills from solver, then it could be less than 100%
        bytes32 hooksHash; // delete - keccak256(pre interactions + post interactions)
        address[] sellTokens;
        address[] buyTokens;
        uint256[] sellAmounts;
        uint256[] buyAmounts;
        uint256[] sellNFTIds;
        uint256[] buyNFTIds;
        bytes sellTokenTransfers; // Commands sequence of sellToken transfer types
        bytes buyTokenTransfers; // Commands sequence of buyToken transfer types
    }


    bytes internal constant ORDER_TYPE = abi.encodePacked(
        "JamOrder(address taker,address receiver,uint256 expiry,uint256 nonce,address executor,uint16 minFillPercent,bytes32 hooksHash,address[] sellTokens,address[] buyTokens,uint256[] sellAmounts,uint256[] buyAmounts,uint256[] sellNFTIds,uint256[] buyNFTIds,bytes sellTokenTransfers,bytes buyTokenTransfers)"
    );
    bytes32 internal constant ORDER_TYPE_HASH = keccak256(ORDER_TYPE);
    string internal constant PERMIT2_ORDER_TYPE = string(
        abi.encodePacked("JamOrder witness)", ORDER_TYPE, "TokenPermissions(address token,uint256 amount)")
    );

    /// @notice hash the given order
    /// @param order the order to hash
    /// @return the eip-712 order hash
    function hash(Data calldata order, bytes32 hooksHash) internal pure returns (bytes32) {
        return keccak256(
            // divide order into two parts and encode them separately to avoid stack too deep exception
            bytes.concat(
                abi.encode(
                    ORDER_TYPE_HASH,
                    order.taker,
                    order.receiver,
                    order.expiry,
                    order.nonce,
                    order.executor,
                    order.minFillPercent,
                    hooksHash
                ),
                abi.encode(
                    keccak256(abi.encodePacked(order.sellTokens)),
                    keccak256(abi.encodePacked(order.buyTokens)),
                    keccak256(abi.encodePacked(order.sellAmounts)),
                    keccak256(abi.encodePacked(order.buyAmounts)),
                    keccak256(abi.encodePacked(order.sellNFTIds)),
                    keccak256(abi.encodePacked(order.buyNFTIds)),
                    keccak256(order.sellTokenTransfers),
                    keccak256(order.buyTokenTransfers)
                )
            )
        );
    }

    function toBatchPermit2(Data calldata order) internal pure returns (IPermit2.PermitBatchTransferFrom memory) {
        IPermit2.TokenPermissions[] memory permitted = new IPermit2.TokenPermissions[](order.sellTokens.length);
        for (uint i; i < order.sellTokens.length; ++i) {
            permitted[i] = IPermit2.TokenPermissions(order.sellTokens[i], order.sellAmounts[i]);
        }
        return IPermit2.PermitBatchTransferFrom(permitted, order.nonce, order.expiry);
    }

    function toSignatureTransferDetails(
        Data calldata order, address receiver, uint16 fillPercent
    ) internal pure returns (IPermit2.SignatureTransferDetails[] memory) {
        IPermit2.SignatureTransferDetails[] memory details = new IPermit2.SignatureTransferDetails[](order.sellTokens.length);
        for (uint i; i < order.sellTokens.length; ++i) {
            details[i] = IPermit2.SignatureTransferDetails(receiver, BMath.getPercentage(order.sellAmounts[i], fillPercent));
        }
        return details;
    }


}
