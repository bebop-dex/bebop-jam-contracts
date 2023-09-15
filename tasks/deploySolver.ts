import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function deploySolver(
  params: { settlement: string },
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;

  console.log("Deploying JamSolver...")
  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.deploy(params.settlement);
  await solverContract.deployed();
  console.log("JamSolver deployed to:", solverContract.address)

  const solver = (await ethers.getSigners())[0];

  console.log({
    "settlement": params.settlement,
    "solver": solver.address,
    "JamSolver": solverContract.address
  })
}
