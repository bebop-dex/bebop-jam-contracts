// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../libraries/JamInteraction.sol";
import "../libraries/JamOrder.sol";
import "../libraries/JamHooks.sol";
import "../libraries/Signature.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title JamSigning
/// @notice Functions which handles the signing and validation of Jam orders
abstract contract JamSigning {
    mapping(address => mapping(uint256 => uint256)) private takerInvalidNonces;

    bytes32 private constant DOMAIN_NAME = keccak256("JamSettlement");
    bytes32 private constant DOMAIN_VERSION = keccak256("1");

    bytes4 private constant EIP1271_MAGICVALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));
    uint256 private constant ETH_SIGN_HASH_PREFIX = 0x19457468657265756d205369676e6564204d6573736167653a0a333200000000;

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    ));

    bytes32 public constant JAM_ORDER_TYPE_HASH = keccak256(abi.encodePacked(
        "JamOrder(address taker,address receiver,uint32 expiry,uint256 nonce,bytes32 hooksHash,address[] sellTokens,address[] buyTokens,uint256[] sellAmounts,uint256[] buyAmounts,uint256[] sellNFTIds,uint256[] buyNFTIds,bytes sellTokenTransfers,bytes buyTokenTransfers)"
    ));

    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    constructor(){
        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, DOMAIN_NAME, DOMAIN_VERSION, block.chainid, address(this))
        );
    }

    /// @notice The domain separator used in the order validation signature
    /// @return The domain separator used in encoding of order signature
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _CACHED_CHAIN_ID
            ? _CACHED_DOMAIN_SEPARATOR
            : keccak256(
                abi.encode(EIP712_DOMAIN_TYPEHASH, DOMAIN_NAME, DOMAIN_VERSION, block.chainid, address(this))
            );
    }

    /// @notice Hash beforeSettle and afterSettle interactions
    /// @param hooks pre and post interactions to hash
    /// @return The hash of the interactions
    function hashHooks(JamHooks.Def calldata hooks) public pure returns (bytes32) {
        // TODO: optimise with encodePacked?
        return keccak256(abi.encode(hooks));
    }

    /// @notice Hash the order info and hooks
    /// @param order The order to hash
    /// @param hooksHash The hash of the hooks
    /// @return The hash of the order
    function hashOrder(JamOrder.Data calldata order, bytes32 hooksHash) public view returns (bytes32) {
        return
        keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        JAM_ORDER_TYPE_HASH,
                        order.taker,
                        order.receiver,
                        order.expiry,
                        order.nonce,
                        hooksHash,
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
            )
        );
    }

    /// @notice Validate the order signature
    /// @param validationAddress The address to validate the signature against
    /// @param hash The hash of the order
    /// @param signature The signature to validate
    function validateSignature(address validationAddress, bytes32 hash, Signature.TypedSignature calldata signature) public view {
        if (signature.signatureType == Signature.Type.EIP712) {
            (bytes32 r, bytes32 s, uint8 v) = Signature.getRsv(signature.signatureBytes);
            address signer = ecrecover(hash, v, r, s);
            require(signer != address(0), "Invalid signer");
            if (signer != validationAddress) {
                revert("Invalid EIP712 order signature");
            }
        } else if (signature.signatureType == Signature.Type.EIP1271) {
            require(
                IERC1271(validationAddress).isValidSignature(hash, signature.signatureBytes) == EIP1271_MAGICVALUE,
                "Invalid EIP1271 order signature"
            );
        } else if (signature.signatureType == Signature.Type.ETHSIGN) {
            bytes32 ethSignHash;
            assembly {
                mstore(0, ETH_SIGN_HASH_PREFIX) // length of 28 bytes
                mstore(28, hash) // length of 32 bytes
                ethSignHash := keccak256(0, 60)
            }
            (bytes32 r, bytes32 s, uint8 v) = Signature.getRsv(signature.signatureBytes);
            address signer = ecrecover(ethSignHash, v, r, s);
            require(signer != address(0), "Invalid signer");
            if (signer != validationAddress) {
                revert("Invalid ETHSIGH order signature");
            }
        } else {
            revert("Invalid Signature Type");
        }
    }

    /// @notice validate all information about the order
    /// @param order The order to validate
    /// @param hooks User's hooks to validate
    /// @param signature The signature to check against
    function validateOrder(JamOrder.Data calldata order, JamHooks.Def calldata hooks, Signature.TypedSignature calldata signature) public {
        // Allow settle from user without sig
        if (order.taker != msg.sender) {
            bytes32 hooksHash = hashHooks(hooks);
            bytes32 orderHash = hashOrder(order, hooksHash);
            validateSignature(order.taker, orderHash, signature);
        }
        require(order.buyTokens.length == order.buyAmounts.length, "INVALID_BUY_TOKENS_LENGTH");
        require(order.buyTokens.length == order.buyTokenTransfers.length, "INVALID_BUY_TRANSFERS_LENGTH");
        require(order.sellTokens.length == order.sellAmounts.length, "INVALID_SELL_TOKENS_LENGTH");
        require(order.sellTokens.length == order.sellTokenTransfers.length, "INVALID_SELL_TRANSFERS_LENGTH");
        invalidateOrderNonce(order.taker, order.nonce);
        require(block.timestamp < order.expiry, "ORDER_EXPIRED");
    }

    function cancelLimitOrder(uint256 nonce) external {
        invalidateOrderNonce(msg.sender, nonce);
    }

    /// @notice Check if nonce is valid and invalidate it
    /// @param nonce The nonce to invalidate
    function invalidateOrderNonce(address taker, uint256 nonce) private {
        require(nonce != 0, "ZERO_NONCE");
        uint256 invalidatorSlot = nonce >> 8;
        uint256 invalidatorBit = 1 << (nonce & 0xff);
        mapping(uint256 => uint256) storage invalidNonces = takerInvalidNonces[taker];
        uint256 invalidator = invalidNonces[invalidatorSlot];
        require(invalidator & invalidatorBit != invalidatorBit, "INVALID_NONCE");
        invalidNonces[invalidatorSlot] = invalidator | invalidatorBit;
    }

    /// @notice validate if increased amounts are more than initial amounts that user signed
    /// @param increasedAmounts The increased amounts to validate (if empty, return initial amounts)
    /// @param initialAmounts The initial amounts to validate against
    /// @return The increased amounts if exist, otherwise the initial amounts
    function validateIncreasedAmounts(
        uint256[] calldata increasedAmounts, uint256[] calldata initialAmounts
    ) internal returns (uint256[] calldata){
        if (increasedAmounts.length == 0) {
            return initialAmounts;
        }
        require(increasedAmounts.length == initialAmounts.length, "INVALID_INCREASED_AMOUNTS_LENGTH");
        for (uint256 i; i < increasedAmounts.length; ++i) {
            require(increasedAmounts[i] >= initialAmounts[i], "INVALID_INCREASED_AMOUNTS");
        }
        return increasedAmounts;
    }
}
