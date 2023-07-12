// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/JamInteraction.sol";

contract JamSolver {
    using SafeERC20 for IERC20;
    address private owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function withdraw (address receiver) public onlyOwner {
        if (address(this).balance > 0) {
            payable(receiver).transfer(address(this).balance);
        }
    }

    function wihtdrawTokens (address[] calldata tokens, address receiver) public onlyOwner {
        for (uint i; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            if (token.balanceOf(address(this)) > 0) {
                token.safeTransfer(receiver, token.balanceOf(address(this)));
            }
        }
    }

    function execute (JamInteraction.Data[] calldata calls, address[] calldata outputTokens, uint256[] calldata outputAmounts, address receiver) public {
        for(uint i; i < calls.length; i++) {
            JamInteraction.execute(calls[i]);
        }
        for(uint i; i < outputTokens.length; i++) {
            IERC20 token = IERC20(outputTokens[i]);
            token.transfer(receiver, outputAmounts[i]);
        }
    }
}