// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/JamInteraction.sol";

contract JamSolver {
    using SafeERC20 for IERC20;
    address public owner;
    address public settlement;

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
            payable(receiver).call{value: address(this).balance}("");
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

    function execute (
        JamInteraction.Data[] calldata calls, address[] calldata outputTokens, uint256[] calldata outputAmounts, address receiver
    ) public payable onlyOwnerOrigin onlySettlement {
        for(uint i; i < calls.length; i++) {
            JamInteraction.execute(calls[i]);
        }
        for(uint i; i < outputTokens.length; i++) {
            IERC20 token = IERC20(outputTokens[i]);
            token.transfer(receiver, outputAmounts[i]);
        }
    }
}