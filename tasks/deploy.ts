import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export default async function deploy(
  params: any,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;
  console.log("Deploying JamSettlement...");
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy('0x000000000022d473030f116ddee9f6b43ac78ba3');
  console.log("Hash:", settlement.deployTransaction.hash);
  await settlement.deployed();
  console.log("JamSettlement deployed to:", settlement.address);

  const balanceManagerAddress = await settlement.balanceManager();

  console.log({
    "JamSettlement": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}
