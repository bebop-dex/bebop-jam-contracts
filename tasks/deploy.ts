import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getPermit2Address, getDaiAddress } from './addresses'

export default async function deploy(
  params: any,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;
  console.log("Deploying JamSettlement...");
  const chainId = (await ethers.provider.getNetwork()).chainId
  const permit2Address = getPermit2Address(chainId)
  const daiAddress = getDaiAddress(chainId)
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(permit2Address, daiAddress)
  console.log("Hash:", settlement.deployTransaction.hash);
  await settlement.deployed();
  console.log("JamSettlement deployed to:", settlement.address);

  const balanceManagerAddress = await settlement.balanceManager();

  console.log({
    "JamSettlement": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}
