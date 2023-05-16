// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import "../src/JamSolverRegistry.sol";

contract JamSolverRegistryTest is Test {
    JamSolverRegistry r;

    function setUp() public {
        r = new JamSolverRegistry();
    }

    function testAddSolver() public {
        r.add(msg.sender);
        assertTrue(r.isAllowed(msg.sender));
    }
}
