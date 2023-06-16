// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./interfaces/IJamSolverRegistry.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";


/// @title JamSolverRegistry
/// @notice Allows specific addresses to interact with settlement. Because the settlement contract is a receiver of funds
/// We only let known parties interact with the contract to reduce the attack surface - although the settlement does itself
/// ensure that user receives what they signed for.
contract JamSolverRegistry is Ownable, IJamSolverRegistry {
    mapping (address => bool) public solvers;

    /// @inheritdoc IJamSolverRegistry
    function add(address solver) external onlyOwner() {
        solvers[solver] = true;
        emit RegistryUpdated(solver, true);
    }

    /// @inheritdoc IJamSolverRegistry
    function remove(address solver) external onlyOwner() {
        delete solvers[solver];
        emit RegistryUpdated(solver, false);
    }

    /// @inheritdoc IJamSolverRegistry
    function isAllowed(address solver) external view returns (bool) {
        return solvers[solver];
    }
}