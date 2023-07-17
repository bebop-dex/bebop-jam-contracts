// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./interfaces/IJamBalanceManager.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/JamTransfer.sol";
import "./libraries/common/SafeCast160.sol";
import "./interfaces/IPermit2.sol";

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
        uint256[] calldata amounts
    ) onlyOperator(msg.sender) external {
        // Will need to handler other allowance types
        // It can also have internal balances
        require(tokens.length == amounts.length, "INVALID_LENGTHS");
        if (info.usingPermit2){
            IPermit2.AllowanceTransferDetails[] memory batchTransferDetails = new IPermit2.AllowanceTransferDetails[](tokens.length);
            for (uint i; i < tokens.length; ++i) {
                batchTransferDetails[i] = IPermit2.AllowanceTransferDetails({
                    from: from,
                    to: info.balanceRecipient,
                    amount: SafeCast160.toUint160(amounts[i]),
                    token: tokens[i]
                });
            }
            PERMIT2.transferFrom(batchTransferDetails);
        } else {
            for (uint i; i < tokens.length; ++i) {
                IERC20(tokens[i]).safeTransferFrom(from, info.balanceRecipient, amounts[i]);
            }
        }
    }
}