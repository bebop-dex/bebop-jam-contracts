import { ethers } from "hardhat";
import { JamAllowanceManager, JamSettlement, JamSolverRegistry } from "../typechain-types";

export async function getFixture () {
  const [deployer, solver, user, ...users] = await ethers.getSigners();
  
  const ERC20Token = await ethers.getContractFactory("ERC20Token");
  const token1 = await ERC20Token.deploy('Token 1', 'TOK1');
  await token1.deployed();
  const token2 = await ERC20Token.deploy('Token 1', 'TOK1');
  await token2.deployed();

  const JamSolverRegistry = await ethers.getContractFactory("JamSolverRegistry");
  const registry = await JamSolverRegistry.deploy();
  await registry.deployed();
  
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(registry.address);
  await settlement.deployed();

  const allowanceManagerAddress = await settlement.allowanceManager();
  const JamAllowanceManager = await ethers.getContractFactory("JamAllowanceManager");
  const allowanceManager: JamAllowanceManager = await JamAllowanceManager.attach(allowanceManagerAddress);

  await registry.add(solver.address);

  return {
    deployer,
    solver,
    user,
    users,
    registry,
    settlement,
    allowanceManager,
    token1,
    token2
  }
}