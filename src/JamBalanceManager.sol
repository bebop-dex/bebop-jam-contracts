// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./interfaces/IJamBalanceManager.sol";
import "./libraries/JamTransfer.sol";
import "./libraries/JamOrder.sol";
import "./libraries/common/SafeCast160.sol";
import "./interfaces/IPermit2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title JamBalanceManager
/// @notice The reason a balance manager exists is to prevent interaction to the settlement contract draining user funds
/// By having another contract that allowances are made to, we can enforce that it is only used to draw in user balances to settlement and not sent out
contract JamBalanceManager is IJamBalanceManager {
    address private immutable operator;

    using SafeERC20 for IERC20;

    IPermit2 private immutable PERMIT2;
    address private constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address _operator, address _permit2) {
        // Operator can be defined at creation time with `msg.sender` 
        // Pass in the settlement - and that can be the only caller.
        operator = _operator;
        PERMIT2 = IPermit2(_permit2);
    }

    modifier onlyOperator(address account) {
        require(account == operator, "INVALID_CALLER");
        _;
    }

    /// @inheritdoc IJamBalanceManager
    function transferTokens(
        address from,
        address receiver,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes
    ) onlyOperator(msg.sender) external {
        IPermit2.AllowanceTransferDetails[] memory batchTransferDetails;
        JamTransfer.Indices memory indices = JamTransfer.Indices(0, 0);
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                IERC20(tokens[i]).safeTransferFrom(from, receiver, amounts[i]);
            } else if (tokenTransferTypes[i] == Commands.PERMIT2_TRANSFER) {
                if (indices.permit2BatchInd == 0){
                    batchTransferDetails = new IPermit2.AllowanceTransferDetails[](tokens.length - i);
                }
                batchTransferDetails[indices.permit2BatchInd++] = IPermit2.AllowanceTransferDetails({
                    from: from,
                    to: receiver,
                    amount: SafeCast160.toUint160(amounts[i]),
                    token: tokens[i]
                });
                continue;
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER) {
                require(tokens[i] == NATIVE_TOKEN, "INVALID_NATIVE_TOKEN_ADDRESS");
                if (receiver != operator){
                    payable(receiver).call{value: amounts[i]}("");
                }
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                require(amounts[i] == 1, "INVALID_ERC721_AMOUNT");
                IERC721(tokens[i]).safeTransferFrom(from, receiver, nftIds[indices.curNFTsInd++]);
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                IERC1155(tokens[i]).safeTransferFrom(from, receiver, nftIds[indices.curNFTsInd++], amounts[i], "");
            } else {
                revert("INVALID_TRANSFER_TYPE");
            }

            // Shortening batch arrays
            if (indices.permit2BatchInd != 0){
                assembly {mstore(batchTransferDetails, sub(mload(batchTransferDetails), 1))}
            }
        }
        require(indices.curNFTsInd == nftIds.length, "INVALID_NFT_IDS_LENGTH");

        // Batch transfers
        if (indices.permit2BatchInd != 0){
            require(indices.permit2BatchInd == batchTransferDetails.length, "INVALID_BATCH_PERMIT2_LENGTH");
            PERMIT2.transferFrom(batchTransferDetails);
        }
    }
}