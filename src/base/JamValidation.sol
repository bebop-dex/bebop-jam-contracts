// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../base/Errors.sol";
import "../libraries/JamOrder.sol";
import "../libraries/JamHooks.sol";
import "../libraries/common/BMath.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title JamSigning
/// @notice Functions which handles the signing and validation of Jam orders
abstract contract JamValidation {
    mapping(address => mapping(uint256 => uint256)) private standardNonces;
    mapping(address => mapping(uint256 => uint256)) private limitOrdersNonces;
    uint256 private constant INF_EXPIRY = 9999999999; // expiry for limit orders

    bytes32 private constant DOMAIN_NAME = keccak256("JamSettlement");
    bytes32 private constant DOMAIN_VERSION = keccak256("1");
    bytes32 private constant UPPER_BIT_MASK = (0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
    bytes4 private constant EIP1271_MAGICVALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));
    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
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

    /// @notice Validate the order signature
    /// @param validationAddress The address to validate the signature against
    /// @param hash The hash of the order
    /// @param signature The signature to validate
    function validateSignature(address validationAddress, bytes32 hash, bytes calldata signature) public view {
        bytes32 r;
        bytes32 s;
        uint8 v;
        if (validationAddress.code.length == 0) {
            if (signature.length == 65) {
                (r, s) = abi.decode(signature, (bytes32, bytes32));
                v = uint8(signature[64]);
            } else if (signature.length == 64) {
                // EIP-2098
                bytes32 vs;
                (r, vs) = abi.decode(signature, (bytes32, bytes32));
                s = vs & UPPER_BIT_MASK;
                v = uint8(uint256(vs >> 255)) + 27;
            } else {
                revert InvalidSignatureLength();
            }
            address signer = ecrecover(hash, v, r, s);
            if (signer == address(0)) revert InvalidSignature();
            if (signer != validationAddress) revert InvalidSigner();
        } else {
            bytes4 magicValue = IERC1271(validationAddress).isValidSignature(hash, signature);
            if (magicValue != EIP1271_MAGICVALUE) revert InvalidContractSignature();
        }
    }

    function hashHooks(JamHooks.Def calldata hooks) external pure returns (bytes32) {
        return JamHooks.hash(hooks);
    }


    function validateOrder(
        JamOrder.Data calldata order, bytes calldata signature, bytes32 hooksHash, uint16 curFillPercent, bool usingPermit2
    ) internal {
        // Allow settle from user without sig; For permit2 case, we already validated witness during the transfer
        if (order.taker != msg.sender && !usingPermit2) {
            bytes32 orderHash = keccak256(abi.encodePacked(
                "\x19\x01", DOMAIN_SEPARATOR(), JamOrder.hash(order, hooksHash)
            ));
            validateSignature(order.taker, orderHash, signature);
        }
        require(order.executor == msg.sender || order.executor == address(0), InvalidExecutor());
        require(order.buyTokens.length == order.buyAmounts.length, BuyTokensInvalidLength());
//        require(order.buyTokens.length == order.buyTokenTransfers.length, "INVALID_BUY_TRANSFERS_LENGTH");
        require(order.sellTokens.length == order.sellAmounts.length, SellTokensInvalidLength());
//        require(order.sellTokens.length == order.sellTokenTransfers.length, "INVALID_SELL_TRANSFERS_LENGTH");
        require(curFillPercent >= order.minFillPercent, FillPercentTooLow());
        invalidateOrderNonce(order.taker, order.nonce, order.expiry == INF_EXPIRY);
        require(block.timestamp < order.expiry, OrderExpired());
    }


    /// @notice Cancel limit order by invalidating nonce for the sender address
    /// @param nonce The nonce to invalidate
    function cancelLimitOrder(uint256 nonce) external {
        invalidateOrderNonce(msg.sender, nonce, true);
    }

    /// @notice Check if taker's limit order nonce is valid
    /// @param taker address
    /// @param nonce to check
    /// @return True if nonce is valid
    function isLimitOrderNonceValid(address taker, uint256 nonce) external view returns (bool) {
        uint256 invalidatorSlot = nonce >> 8;
        uint256 invalidatorBit = 1 << (nonce & 0xff);
        return (limitOrdersNonces[taker][invalidatorSlot] & invalidatorBit) == 0;
    }

    /// @notice Check if nonce is valid and invalidate it
    /// @param taker address
    /// @param nonce The nonce to invalidate
    /// @param isLimitOrder True if it is a limit order
    function invalidateOrderNonce(address taker, uint256 nonce, bool isLimitOrder) private {
        require(nonce != 0, ZeroNonce());
        uint256 invalidatorSlot = nonce >> 8;
        uint256 invalidatorBit = 1 << (nonce & 0xff);
        mapping(uint256 => uint256) storage invalidNonces = isLimitOrder ? limitOrdersNonces[taker] : standardNonces[taker];
        uint256 invalidator = invalidNonces[invalidatorSlot];
        require(invalidator & invalidatorBit != invalidatorBit, InvalidNonce());
        invalidNonces[invalidatorSlot] = invalidator | invalidatorBit;
    }

    /// @notice validate if increased amounts are more than initial amounts that user signed
    /// @param increasedAmounts The increased amounts to validate (if empty, return initial amounts)
    /// @param initialAmounts The initial amounts to validate against
    /// @return The increased amounts if exist, otherwise the initial amounts
    function validateIncreasedAmounts(
        uint256[] calldata increasedAmounts, uint256[] calldata initialAmounts
    ) internal pure returns (uint256[] calldata){
        if (increasedAmounts.length == 0) {
            return initialAmounts;
        }
        require(increasedAmounts.length == initialAmounts.length, InvalidIncreasedAmountsLength());
        for (uint256 i; i < increasedAmounts.length; ++i) {
            require(increasedAmounts[i] >= initialAmounts[i], InvalidIncreasedAmounts());
        }
        return increasedAmounts;
    }


    function validateBatchOrders(
        JamOrder.Data[] calldata orders, JamHooks.Def[] calldata hooks, bytes[] calldata signatures,
        bool[] calldata takersPermit2, uint16[] calldata curFillPercents
    ) internal {
        bool isMaxFill = curFillPercents.length == 0;
        bool noHooks = hooks.length == 0;
        bool allTakersWithoutPermit2 = takersPermit2.length == 0;
        require(orders.length == signatures.length, InvalidBatchSignaturesLength());
        require(orders.length == takersPermit2.length || allTakersWithoutPermit2, InvalidBatchPermitsLength());
        require(orders.length == hooks.length || noHooks, InvalidBatchHooksLength());
        require(orders.length == curFillPercents.length || isMaxFill, InvalidBatchFillPercentsLength());
        for (uint i; i < orders.length; ++i) {
            require(orders[i].receiver != address(this), InvalidReceiverInBatch());
            validateOrder(
                orders[i],
                signatures[i],
                noHooks ? JamHooks.EMPTY_HOOKS_HASH : JamHooks.hash(hooks[i]),
                isMaxFill ? BMath.HUNDRED_PERCENT : curFillPercents[i],
                allTakersWithoutPermit2 ? false : takersPermit2[i]
            );
        }
    }
}
