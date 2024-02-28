// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IBlast {
    function configureClaimableGas() external;
    function claimAllGas(address contractAddress, address recipient) external returns (uint256);
    function claimMaxGas(address contractAddress, address recipient) external returns (uint256);
}