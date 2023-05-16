// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @title 
/// @author 
/// @notice 
library JamOrder {

    /// @dev Data respresenting a Jam Order. This data is signed by the 
    /// @dev TODO: addresses and tokens will need to be turned into arrays to support 12m, m21
    struct Data {
        IERC20 buyToken;
        IERC20 sellToken;
        address from;
        address receiver;
        uint32 expiry;
        uint256 sellAmount;
        uint256 buyAmount;
        bytes signature;
        /**
         * TODO: Add `signType`
         * This type + expiry and other flags could be packed into one word
         */

        /**
         * TODO: Part of the above flag word can be type of approval (approve vs permit)
         * Separately there is optional data for permit
         */
    }
}
