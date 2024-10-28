// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../base/Errors.sol";
import "../libraries/JamOrder.sol";
import "../external-libs/SafeTransferLib.sol";

/// @title JamPartner
abstract contract JamPartner {

    uint16 internal constant HUNDRED_PERCENT = 10000;
    address private immutable protocolFeeAddress;

    event NativeTransfer(address indexed receiver, uint256 amount);
    using SafeTransferLib for IERC20;

    constructor(address _protocolFeeAddress){
        protocolFeeAddress = _protocolFeeAddress;
    }

    /// @notice Distribute fees to the partner and protocol, fees are optional
    /// @param partnerInfo The partner info, packed with the partner address, partner fee and protocol fee
    /// @param token The token to distribute fees in
    /// @param amount The amount to distribute
    function distributeFees(uint256 partnerInfo, address token, uint256 amount) internal {
        (address partnerAddress, uint16 partnerFee, uint16 protocolFee) = unpackPartnerInfo(partnerInfo);
        require(partnerFee + protocolFee < HUNDRED_PERCENT, InvalidFeePercentage());
        if (partnerFee > 0) {
            sendPartnerFee(token, amount, partnerFee, partnerAddress);
        }
        if (protocolFee > 0) {
            sendPartnerFee(token, amount, protocolFee, protocolFeeAddress);
        }
    }

    /// @notice Unpack the partner info
    /// @param partnerInfo Packed info: [ .... | address | uint16 | uint16 ]
    function unpackPartnerInfo(uint256 partnerInfo) private pure returns (address, uint16, uint16) {
        uint16 protocolFee = uint16(partnerInfo & 0xFFFF);
        uint16 partnerFee = uint16((partnerInfo >> 16) & 0xFFFF);
        address partnerAddress = address(uint160(partnerInfo >> 32));
        return (partnerAddress, partnerFee, protocolFee);
    }

    /// @notice Send the partner fee
    /// @param token The token to send
    /// @param amount The amount to send
    /// @param fee The fee percentage
    /// @param receiver The receiver of the fee
    function sendPartnerFee(address token, uint256 amount, uint16 fee, address receiver) private {
        uint256 feeAmount = amount * fee / HUNDRED_PERCENT;
        if (token == JamOrderLib.NATIVE_TOKEN) {
            (bool sent, ) = payable(receiver).call{value: feeAmount}("");
            require(sent, FailedToSendEth());
            emit NativeTransfer(receiver, feeAmount);
        } else {
            IERC20(token).safeTransfer(receiver, feeAmount);
        }
    }

}