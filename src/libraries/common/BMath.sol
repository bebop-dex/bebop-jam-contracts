// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

library BMath {
    function getPercentage(uint256 value, uint16 percent) internal view returns (uint256){
        if (percent >= 10000){
            return value;
        }
        return value * percent / 10000;
    }

    function getInvertedPercentage(uint256 value, uint16 percent) internal view returns (uint256){
        if (percent >= 10000){
            return value;
        }
        return value * 10000 / percent;
    }

}