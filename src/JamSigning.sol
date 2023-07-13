// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";
import "./libraries/JamHooks.sol";
import "./libraries/Signature.sol";

abstract contract JamSigning {
    mapping(uint256 => bool) private invalidNonces;

    bytes32 private constant DOMAIN_NAME = keccak256("JamSettlement");
    bytes32 private constant DOMAIN_VERSION = keccak256("1");

    bytes4 private constant EIP1271_MAGICVALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    ));

    bytes32 public constant JAM_ORDER_TYPE_HASH = keccak256(abi.encodePacked(
        "JamOrder(address taker,address receiver,uint32 expiry,uint256 nonce,bytes32 hooksHash,address[] buyTokens,address[] sellTokens,uint256[] buyAmounts,uint256[] sellAmounts)"
    ));

    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor(){
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                DOMAIN_NAME,
                DOMAIN_VERSION,
                chainId,
                address(this)
            )
        );
    }

    function hashHooks(JamHooks.Def memory hooks) public pure returns (bytes32) {
        // TODO: optimise with encodePacked? 
        return keccak256(abi.encode(hooks));
    }

    function hashOrder(JamOrder.Data memory order, bytes32 hooksHash) public view returns (bytes32) {
        return
        keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        JAM_ORDER_TYPE_HASH,
                        order.taker,
                        order.receiver,
                        order.expiry,
                        order.nonce,
                        hooksHash,
                        keccak256(abi.encodePacked(order.buyTokens)),
                        keccak256(abi.encodePacked(order.sellTokens)),
                        keccak256(abi.encodePacked(order.buyAmounts)),
                        keccak256(abi.encodePacked(order.sellAmounts))
                    )
                )
            )
        );
    }

    function validateSignature(address validationAddress, bytes32 hash, Signature.TypedSignature memory signature) public pure {
        if (signature.signatureType == Signature.Type.EIP712) {
            // Signed using EIP712
            (bytes32 r, bytes32 s, uint8 v) = Signature.getRsv(signature.signatureBytes);
            address signer = ecrecover(hash, v, r, s);
            require(signer != address(0), "Invalid signer");
            if (signer != validationAddress) {
                revert("Invalid EIP712 order signature");
            }
        } else {
            revert("Invalid Signature Type");
        }
    }

    function validateOrder(JamOrder.Data memory order, JamHooks.Def memory hooks, Signature.TypedSignature memory signature) public {
        validateNonce(order.nonce);
        // Allow settle from user without sig
        if (order.taker != msg.sender) {
            bytes32 hooksHash = hashHooks(hooks);
            bytes32 orderHash = hashOrder(order, hooksHash);
            validateSignature(order.taker, orderHash, signature);
        }
        invalidateNonce(order.nonce);
    }

    function invalidateNonce(uint256 nonce) private {
        invalidNonces[nonce] = true;
    }

    function validateNonce(uint256 nonce) private view {
        require(!invalidNonces[nonce], "INVALID_NONCE");
    }
}
