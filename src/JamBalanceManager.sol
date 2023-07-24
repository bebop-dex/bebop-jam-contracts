// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./interfaces/IJamBalanceManager.sol";
import "./libraries/JamTransfer.sol";
import "./libraries/JamOrder.sol";
import "./libraries/common/SafeCast160.sol";
import "./interfaces/IPermit2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title JamBalanceManager
/// @notice The reason a balance manager exists is to prevent interaction to the settlement contract draining user funds
/// By having another contract that allowances are made to, we can enforce that it is only used to draw in user balances to settlement and not sent out
contract JamBalanceManager is IJamBalanceManager {
    address operator;

    using SafeERC20 for IERC20;

    IPermit2 private immutable PERMIT2;

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
        JamTransfer.Initial calldata info,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata tokenTransferTypes
    ) onlyOperator(msg.sender) external {
        require(tokens.length == amounts.length, "INVALID_TOKENS_LENGTH");
        require(tokens.length == tokenTransferTypes.length, "INVALID_TRANSFERS_LENGTH");

        IPermit2.AllowanceTransferDetails[] memory batchTransferDetails;
        uint permit2BatchInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                IERC20(tokens[i]).safeTransferFrom(from, info.balanceRecipient, amounts[i]);
            } else if (tokenTransferTypes[i] == Commands.PERMIT2_TRANSFER) {
                if (permit2BatchInd == 0){
                    batchTransferDetails = new IPermit2.AllowanceTransferDetails[](tokens.length - i);
                }
                batchTransferDetails[permit2BatchInd] = IPermit2.AllowanceTransferDetails({
                    from: from,
                    to: info.balanceRecipient,
                    amount: SafeCast160.toUint160(amounts[i]),
                    token: tokens[i]
                });
                ++permit2BatchInd;
                continue;
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER) {
                if (info.balanceRecipient != operator){
                    payable(info.balanceRecipient).call{value: amounts[i]}("");
                }
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                IERC721(tokens[i]).safeTransferFrom(from, info.balanceRecipient, amounts[i]);
            } else {
                revert("INVALID_TRANSFER_TYPE");
            }
            if (permit2BatchInd != 0){
                assembly {mstore(batchTransferDetails, sub(mload(batchTransferDetails), 1))}
            }
        }
        if (permit2BatchInd != 0){
            require(permit2BatchInd == batchTransferDetails.length, "INVALID_BATCH_PERMIT2_LENGTH");
            PERMIT2.transferFrom(batchTransferDetails);
        }

    }
}