import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export default async function example(
  params: any,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;

  const JamSolverRegistry = await ethers.getContractFactory("JamSolverRegistry");
  const registry = await JamSolverRegistry.deploy();
  await registry.deployed();
  
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(registry.address);
  await settlement.deployed();

  const balanceManagerAddress = await settlement.balanceManager();

  console.log({
    "JamSettlement": settlement.address,
    "JamSolverRegistry": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}
