// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./interfaces/IJamSolverRegistry.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";


contract JamSolverRegistry is IJamSolverRegistry {
    address public owner;
    mapping (address => bool) public solvers;

    constructor() {
        owner = msg.sender;
    }

    /// @inheritdoc IJamSolverRegistry
    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }

    /// @inheritdoc IJamSolverRegistry
    function add(address solver) external {
        solvers[solver] = true;
        emit RegistryUpdated(solver, true);
    }

    /// @inheritdoc IJamSolverRegistry
    function remove(address solver) external {
        delete solvers[solver];
        emit RegistryUpdated(solver, false);
    }

    /// @inheritdoc IJamSolverRegistry
    function isAllowed(address solver) external view returns (bool) {
        return solvers[solver];
    }
}