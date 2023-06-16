// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../libraries/JamInteraction.sol";
import "../libraries/JamOrder.sol";

interface IJamSolverRegistry {
    event RegistryUpdated(
        address indexed solver,
        bool allowed
    );

    /// @dev Registers a solver
    /// @param solver the solver address to add
    function add(address solver) external;
    /// Revokes a solver
    /// @param solver the solver address to remove
    function remove(address solver) external;

    /// @dev Returns whether the given address is allowed in the registry.
    /// @param account the address of the solver to check
    function isAllowed(address account) external view returns (bool);
}