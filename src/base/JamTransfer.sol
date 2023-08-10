// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../libraries/JamOrder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract JamTransfer {

    using SafeERC20 for IERC20;

    function transferTokensFromContract(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes,
        address receiver
    ) internal {
        uint nftInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                uint tokenBalance = IERC20(tokens[i]).balanceOf(address(this));
                require(tokenBalance >= amounts[i], "INVALID_OUTPUT_TOKEN_BALANCE");
                IERC20(tokens[i]).safeTransfer(receiver, tokenBalance);
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER){
                require(tokens[i] == JamOrder.NATIVE_TOKEN, "INVALID_NATIVE_TOKEN");
                uint tokenBalance = address(this).balance;
                require(tokenBalance >= amounts[i], "INVALID_OUTPUT_NATIVE_BALANCE");
                (bool sent, ) = payable(receiver).call{value: tokenBalance}("");
                require(sent, "FAILED_TO_SEND_ETH");
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                uint tokenBalance = IERC721(tokens[i]).balanceOf(address(this));
                require(amounts[i] == 1 && tokenBalance >= 1, "INVALID_OUTPUT_ERC721_AMOUNT");
                IERC721(tokens[i]).safeTransferFrom(address(this), receiver, nftIds[nftInd++]);
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                uint tokenBalance = IERC1155(tokens[i]).balanceOf(address(this), nftIds[nftInd]);
                require(tokenBalance >= amounts[i], "INVALID_OUTPUT_ERC1155_BALANCE");
                IERC1155(tokens[i]).safeTransferFrom(address(this), receiver, nftIds[nftInd++], tokenBalance, "");
            } else {
                revert("INVALID_TRANSFER_TYPE");
            }
        }
    }
}
