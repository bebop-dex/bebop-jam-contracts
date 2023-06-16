// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import "../src/JamSolverRegistry.sol";

contract JamSolverRegistryTest is Test {
    JamSolverRegistry r;

    address internal solver1;
    address internal solver2;

    address internal anotherAdmin;

    function setUp() public {
        solver1 = address(1);
        solver2 = address(2);
        anotherAdmin = address(3);
        r = new JamSolverRegistry();
    }

    function testAddSolver() public {
        r.add(solver1);
        assertTrue(r.isAllowed(solver1));
        assertFalse(r.isAllowed(solver2));
    }

    function testOwnership() public {
        vm.prank(solver1);
        vm.expectRevert();
        r.add(solver2);
    }

    function testTransfer() public {
        r.transferOwnership(anotherAdmin);
        vm.expectRevert();
        r.add(solver1);
        vm.prank(anotherAdmin);
        r.add(solver1);
        assertTrue(r.isAllowed(solver1));
    }
}
