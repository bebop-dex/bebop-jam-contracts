// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @title 
/// @author 
/// @notice 
library JamOrder {

    /// @dev Data respresenting a Jam Order.
    struct Data {
        address taker;
        address receiver;
        uint32 expiry;
        uint256 nonce;
        bytes32 hooksHash; // keccak256(pre interactions + post interactions)
        IERC20[] buyTokens;
        IERC20[] sellTokens;
        uint256[] sellAmounts;
        uint256[] buyAmounts;
    }
}
