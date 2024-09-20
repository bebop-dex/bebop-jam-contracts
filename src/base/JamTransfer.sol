// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../base/Errors.sol";
import "../libraries/JamOrder.sol";
import "../libraries/common/BMath.sol";
import "../external-libs/SafeTransferLib.sol";

/// @title JamTransfer
/// @notice Functions for transferring tokens from SettlementContract
abstract contract JamTransfer {

    event NativeTransfer(address indexed receiver, uint256 amount);
    using SafeTransferLib for IERC20;

    function approveToken(IERC20 token, uint256 amount, address spender) internal {
        uint256 allowance = token.allowance(address(this), spender);
        if (allowance < amount) {
            token.safeApproveWithRetry(spender, type(uint256).max);
        }
    }

    /// @dev After solver settlement, transfer tokens from this contract to receiver
    /// @param tokens tokens' addresses
    /// @param amounts tokens' amounts
    /// @param receiver address
    /// @param fillPercent solver's fill percentage
    /// @param transferExactAmounts if true, transfer exact amounts, otherwise transfer full tokens balance
    function transferTokensFromContract(
        address[] calldata tokens,
        uint256[] memory amounts,
        address receiver,
        uint16 fillPercent,
        bool transferExactAmounts
    ) internal {
        for (uint i; i < tokens.length; ++i) {
            if (tokens[i] == JamOrder.NATIVE_TOKEN) {
                uint tokenBalance = address(this).balance;
                uint partialFillAmount = BMath.getPercentage(amounts[i], fillPercent);
                require(tokenBalance >= partialFillAmount, InvalidOutputBalance(tokens[i], partialFillAmount, tokenBalance));
                (bool sent, ) = payable(receiver).call{value: transferExactAmounts ?  partialFillAmount : tokenBalance}("");
                require(sent, FailedToSendEth());
                emit NativeTransfer(receiver, transferExactAmounts ? partialFillAmount : tokenBalance);
            } else {
                uint tokenBalance = IERC20(tokens[i]).balanceOf(address(this));
                uint partialFillAmount = BMath.getPercentage(amounts[i], fillPercent);
                require(tokenBalance >= partialFillAmount, InvalidOutputBalance(tokens[i], partialFillAmount, tokenBalance));
                IERC20(tokens[i]).safeTransfer(receiver, transferExactAmounts ? partialFillAmount : tokenBalance);
            }
        }
    }

    /// @dev Transfer native tokens to receiver from this contract
    /// @param receiver address
    /// @param amount amount of native tokens
    function transferNativeFromContract(address receiver, uint256 amount) public {
        (bool sent, ) = payable(receiver).call{value: amount}("");
        require(sent, FailedToSendEth());
    }

    /// @dev Calculate new amounts of tokens if solver transferred excess to contract during settleBatch
    /// @param curInd index of current order
    /// @param orders array of orders
    /// @param fillPercents[] fill percentage
    /// @return array of new amounts
    function calculateNewAmounts(
        uint256 curInd,
        JamOrder.Data[] calldata orders,
        uint16[] memory fillPercents
    ) internal view returns (uint256[] memory) {
        JamOrder.Data calldata curOrder = orders[curInd];
        uint256[] memory newAmounts = new uint256[](curOrder.buyTokens.length);
        uint16 curFillPercent = fillPercents.length == 0 ? BMath.HUNDRED_PERCENT : fillPercents[curInd];
        for (uint i; i < curOrder.buyTokens.length; ++i) {
            if (curOrder.buyTokenTransfers[i] == Commands.SIMPLE_TRANSFER || curOrder.buyTokenTransfers[i] == Commands.NATIVE_TRANSFER) {
                uint256 fullAmount;
                for (uint j = curInd; j < orders.length; ++j) {
                    for (uint k; k < orders[j].buyTokens.length; ++k) {
                        if (orders[j].buyTokens[k] == curOrder.buyTokens[i]) {
                            fullAmount += orders[j].buyAmounts[k];
                            require(fillPercents.length == 0 || curFillPercent == fillPercents[j], InvalidFillPercentForSameToken());
                        }
                    }
                }
                uint256 tokenBalance = curOrder.buyTokenTransfers[i] == Commands.NATIVE_TRANSFER ?
                    address(this).balance : IERC20(curOrder.buyTokens[i]).balanceOf(address(this));
                // if at least two takers buy same token, we need to divide the whole tokenBalance among them.
                // for edge case with newAmounts[i] overflow, solver should submit tx with transferExactAmounts=true
                newAmounts[i] = BMath.getInvertedPercentage(tokenBalance * curOrder.buyAmounts[i] / fullAmount, curFillPercent);
                if (newAmounts[i] < curOrder.buyAmounts[i]) {
                    newAmounts[i] = curOrder.buyAmounts[i];
                }
            } else {
                newAmounts[i] = curOrder.buyAmounts[i];
            }
        }
        return newAmounts;
    }


//    /// @dev Check if there are duplicate tokens
//    /// @param tokens tokens' addresses
//    /// @param nftIds NFTs' ids
//    /// @param tokenTransferTypes command sequence of transfer types
//    /// @return true if there are duplicate tokens
//    function hasDuplicate(
//        address[] calldata tokens, uint256[] calldata nftIds, bytes calldata tokenTransferTypes
//    ) internal pure returns (bool) {
//        if (tokens.length == 0) {
//            return false;
//        }
//        uint curNftInd;
//        for (uint i; i < tokens.length - 1; ++i) {
//            uint tmpNftInd = curNftInd;
//            for (uint j = i + 1; j < tokens.length; ++j) {
//                if (tokenTransferTypes[j] == Commands.NFT_ERC721_TRANSFER || tokenTransferTypes[j] == Commands.NFT_ERC1155_TRANSFER){
//                    ++tmpNftInd;
//                }
//                if (tokens[i] == tokens[j]) {
//                    if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER ||
//                        tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER){
//                        if (nftIds[curNftInd] == nftIds[tmpNftInd]){
//                            return true;
//                        }
//                    } else {
//                        return true;
//                    }
//                }
//            }
//            if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER || tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER){
//                ++curNftInd;
//            }
//        }
//        return false;
//    }
}
