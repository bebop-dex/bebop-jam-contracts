import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export default async function deploy(
  params: any,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;
  
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy();
  await settlement.deployed();

  const balanceManagerAddress = await settlement.balanceManager();

  console.log({
    "JamSettlement": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}
