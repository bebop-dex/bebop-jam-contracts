// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;


import "./libraries/JamInteraction.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "hardhat/console.sol";

contract JamSolver is ERC721Holder, ERC1155Holder{
    using SafeERC20 for IERC20;
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
            if (outputTokens[i] == NATIVE_TOKEN) {
                payable(receiver).call{value: outputAmounts[i]}("");
            } else {
                IERC20 token = IERC20(outputTokens[i]);
                token.transfer(receiver, outputAmounts[i]);
            }
        }
    }

    function executeWithERC721 (
        JamInteraction.Data[] calldata calls, address[] calldata outputTokens, uint256[] calldata outputIds, address receiver
    ) public payable onlyOwnerOrigin onlySettlement {
        for(uint i; i < calls.length; i++) {
            JamInteraction.execute(calls[i]);
        }
        for(uint i; i < outputTokens.length; i++) {
            IERC721 token = IERC721(outputTokens[i]);
            token.transferFrom(address(this), receiver, outputIds[i]);
        }
    }

    function executeWithERC1155 (
        JamInteraction.Data[] calldata calls, address[] calldata outputTokens, uint256[] calldata outputIds, uint256[] calldata outputAmounts, address receiver
    ) public payable onlyOwnerOrigin onlySettlement {
        for(uint i; i < calls.length; i++) {
            JamInteraction.execute(calls[i]);
        }
        for(uint i; i < outputTokens.length; i++) {
            IERC1155 token = IERC1155(outputTokens[i]);
            token.safeTransferFrom(address(this), receiver, outputIds[i], outputAmounts[i], "");
        }
    }
}