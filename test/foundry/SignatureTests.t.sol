// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "./utils/MakerWallet.sol";
import "../../src/JamSettlement.sol";
import "./utils/Utils.sol";

contract SignatureTests is Test, Utils {

    address internal maker;
    JamSettlement internal jam;

    function setUp() public {
        vm.chainId(1);

        maker = address(new EIP1271Wallet());
        jam = new JamSettlement(PERMIT2, address(0), address(0));
    }


    function testValidEIP712Signature() public {
        (address signer, uint256 signingKey) = makeAddrAndKey("someSigner");

        bytes32 message = keccak256("Order Hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, message);
        bytes memory rsv_sig = abi.encodePacked(r, s, v);

        jam.validateSignature(signer, message, rsv_sig);
    }

    function testValidEIP1271Signature() public {
        (address signer, uint256 signingKey) = makeAddrAndKey("someSigner");
        IEIP1271Wallet(maker).addSigner(signer);

        bytes32 message = keccak256("Order Hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, message);
        bytes memory rsv_sig = abi.encodePacked(r, s, v);
        jam.validateSignature(maker, message, rsv_sig);
    }

    function testEIP712InvalidSignature() public {
        (, uint256 signingKey) = makeAddrAndKey("someSigner");

        bytes32 message = keccak256("Order Hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, message);
        bytes memory rsv_sig = abi.encodePacked(r, s, v);

        vm.expectRevert(bytes4(keccak256("InvalidSigner()")));
        jam.validateSignature(makeAddr("anotherSigner"), message, rsv_sig);
    }

}
