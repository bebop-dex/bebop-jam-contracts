// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../libraries/JamOrder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title JamTransfer
/// @notice Functions for transferring tokens from SettlementContract
abstract contract JamTransfer {

    using SafeERC20 for IERC20;

    /// @dev Transfer tokens from this contract to receiver
    /// @param tokens tokens' addresses
    /// @param amounts tokens' amounts
    /// @param nftIds NFTs' ids
    /// @param tokenTransferTypes command sequence of transfer types
    /// @param receiver address
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

    /// @dev Transfer native tokens to receiver from this contract
    /// @param receiver address
    /// @param amount amount of native tokens
    function transferNativeFromContract(address receiver, uint256 amount) public {
        (bool sent, ) = payable(receiver).call{value: amount}("");
        require(sent, "FAILED_TO_SEND_ETH");
    }


    function verifyBalances(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] memory initialAmounts,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes,
        address receiver
    ) internal {
        uint nftInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                uint tokenBalance = IERC20(tokens[i]).balanceOf(receiver);
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_TOKEN_BALANCE");
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER){
                uint tokenBalance = receiver.balance;
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_NATIVE_BALANCE");
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                require(IERC721(tokens[i]).ownerOf(nftIds[nftInd++]) == receiver, "INVALID_ERC721_RECEIVER");
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                uint tokenBalance = IERC1155(tokens[i]).balanceOf(receiver, nftIds[nftInd++]);
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_ERC1155_BALANCE");
            } else {
                revert("INVALID_TRANSFER_TYPE");
            }
        }
    }

    function getInitialBalances(
        address[] calldata tokens,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes,
        address receiver
    ) internal returns (uint256[] memory){
        uint256[] memory initialBalances = new uint256[](tokens.length);
        uint nftInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                initialBalances[i] = IERC20(tokens[i]).balanceOf(receiver);
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER){
                require(tokens[i] == JamOrder.NATIVE_TOKEN, "INVALID_OUTPUT_TOKEN");
                initialBalances[i] = receiver.balance;
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                ++nftInd;
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                initialBalances[i] = IERC1155(tokens[i]).balanceOf(receiver, nftIds[nftInd++]);
            }
        }
        return initialBalances;
    }
}
