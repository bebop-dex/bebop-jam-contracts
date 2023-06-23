import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export default async function addSolver(
  params: {registryAddress: string, solverAddress: string},
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;

  const JamSolverRegistry = await ethers.getContractFactory("JamSolverRegistry");
  const registry = await JamSolverRegistry.attach(params.registryAddress);
  const tx = await registry.add(params.solverAddress);

  console.log(tx.hash)
}
