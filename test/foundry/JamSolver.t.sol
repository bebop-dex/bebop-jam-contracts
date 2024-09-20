// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import "../../src/JamSolver.sol";
import "./utils/MERC20.sol";

contract JamSolverTest is Test {
    JamSolver solverContract;
    address internal settlement;
    address internal solver;
    address internal random;
    MERC20 internal token1;
    MERC20 internal token2;

    function setUp() public {
        solver = address(2);
        random = address(3);
        settlement = address(4);
        token1 = new MERC20('token1', 'TOK1');
        token2 = new MERC20('token2', 'TOK2');
        token1.mint(address(this), 10000000);
        token2.mint(address(this), 10000000);
        vm.prank(solver);

        // TODO: tests validating settlement sender and deployer origin
        solverContract = new JamSolver(settlement);
    }

    function testWithdrawTokens() public {
        token1.transfer(address(solverContract), 100);
        token2.transfer(address(solverContract), 500);
        address[] memory withdrawTokens = new address[](2);
        withdrawTokens[0] = address(token1);
        withdrawTokens[1] = address(token2);
        vm.prank(solver);
        solverContract.withdrawTokens(withdrawTokens, solver);
        assertEq(token1.balanceOf(solver), 100);
        assertEq(token2.balanceOf(solver), 500);
    }

    function testWithdrawEth() public {
        vm.deal(address(solverContract), 1 ether);
        vm.prank(solver);
        solverContract.withdraw(solver);
        assertEq(address(solver).balance, 1 ether);
    }

    function testOwnership() public {
        vm.prank(random);
        vm.expectRevert();
        solverContract.withdraw(solver);

        vm.prank(random);
        vm.expectRevert();
        solverContract.withdrawTokens(new address[](0), random);
    }
}