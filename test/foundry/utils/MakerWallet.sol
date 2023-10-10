// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../src/interfaces/IPermit2.sol";

interface IEIP1271Wallet {
    function isValidSignature(
        bytes32 _hash,
        bytes calldata _signature
    ) external view returns (bytes4);

    function addSigner(
        address signer
    ) external returns (bool);
}

contract EIP1271Wallet is IEIP1271Wallet {

    mapping(address => bool) signers;

    /** Verifies that the signer is the owner of the signing contract.*/
    function isValidSignature(
        bytes32 _hash,
        bytes calldata _signature
    ) external override view returns (bytes4) {
        // Validate signatures
        address recoveredSigner = recoverSigner(_hash, _signature);
        require(signers[recoveredSigner], "Invalid EIP1271 Signature");
        return bytes4(keccak256("isValidSignature(bytes32,bytes)"));
    }

    function addSigner(
        address signer
    ) external override returns (bool) {
        signers[signer] = true;
        return true;
    }

    /**
      * Recover the signer of hash, assuming it's an EOA account
      * @param _hash       Hash of message that was signed
      * @param _signature  Signature encoded as (bytes32 r, bytes32 s, uint8 v)
      */
    function recoverSigner(
        bytes32 _hash,
        bytes memory _signature
    ) internal pure returns (address signer) {
        require(_signature.length == 65, "SignatureValidator#recoverSigner: invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := and(mload(add(_signature, 65)), 255)
        }
        if (v < 27) v += 27;

        // Recover ECDSA signer
        signer = ecrecover(_hash, v, r, s);

        // Prevent signer from being 0x0
        require(
            signer != address(0x0),
            "SignatureValidator#recoverSigner: INVALID_SIGNER"
        );
        return signer;
    }

    function approve(
        address token,
        address spender
    ) external {
        IERC20(token).approve(spender, type(uint256).max);
    }

    function permit(
        address permit2,
        bytes memory signature,
        IPermit2.PermitBatch memory batch
    ) external {
        IPermit2(permit2).permit(address(this), batch, signature);
    }
}