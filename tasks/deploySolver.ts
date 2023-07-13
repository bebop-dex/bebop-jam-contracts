import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export default async function deploySolver(
  params: { settlement: string },
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;

  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.deploy(params.settlement);
  await solverContract.deployed();

  const solver = (await ethers.getSigners())[0];

  console.log({
    "settlement": params.settlement,
    "solver": solver.address,
    "JamSolver": solverContract.address
  })
}