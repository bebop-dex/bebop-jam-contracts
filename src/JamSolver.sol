// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;


import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";
import "./external-libs/SafeTransferLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title JamSolver
/// @notice This is an example of solver used for tests only
contract JamSolver {
    using SafeTransferLib for IERC20;
    address public owner;
    address public settlement;
    address private constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address _settlement) {
        owner = msg.sender;
        settlement = _settlement;
    }

    receive() external payable {}

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier onlySettlement() {
        require(msg.sender == settlement);
        _;
    }

    modifier onlyOwnerOrigin() {
        require(tx.origin == owner);
        _;
    }

    function withdraw (address receiver) public onlyOwner {
        if (address(this).balance > 0) {
            (bool sent, ) = payable(receiver).call{value: address(this).balance}("");
            require(sent, "Failed to send Ether");
        }
    }

    function withdrawTokens (address[] calldata tokens, address receiver) public onlyOwner {
        for (uint i; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            if (token.balanceOf(address(this)) > 0) {
                token.safeTransfer(receiver, token.balanceOf(address(this)));
            }
        }
    }

    function simpleExecute (
        JamInteraction.Data[] calldata calls, address[] calldata outputTokens, uint256[] calldata outputAmounts, address receiver
    ) public payable onlyOwnerOrigin onlySettlement {
        for(uint i; i < calls.length; i++) {
            (bool success, ) = payable(calls[i].to).call{value: calls[i].value}(calls[i].data);
            require(success, "Interaction failed");
        }

        for(uint i; i < outputTokens.length; i++) {
            if (outputTokens[i] == NATIVE_TOKEN){
                (bool sent, ) = payable(receiver).call{value: outputAmounts[i]}("");
                require(sent, "Failed to send Ether");
            } else {
                IERC20 token = IERC20(outputTokens[i]);
                token.safeTransfer(receiver, outputAmounts[i]);
            }
        }
    }
}