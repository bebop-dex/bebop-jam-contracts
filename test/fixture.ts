import { ethers } from "hardhat";

export async function getFixture () {
  const [deployer, solver, user, ...users] = await ethers.getSigners();
  
  const ERC20Token = await ethers.getContractFactory("ERC20Token");
  const token1 = await ERC20Token.deploy('Token 1', 'TOK1');
  await token1.deployed();
  const token2 = await ERC20Token.deploy('Token 2', 'TOK2');
  await token2.deployed();
  const token3 = await ERC20Token.deploy('Token 3', 'TOK3');
  await token3.deployed();
  
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy();
  await settlement.deployed();

  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.connect(solver).deploy(settlement.address);
  await solverContract.deployed();

  const balanceManagerAddress = await settlement.balanceManager();
  const JamBalanceManager = await ethers.getContractFactory("JamBalanceManager");
  const balanceManager = await JamBalanceManager.attach(balanceManagerAddress);


  return {
    deployer,
    solver,
    solverContract,
    user,
    users,
    settlement,
    balanceManager,
    token1,
    token2,
    token3
  }
}