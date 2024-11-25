import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {getBebopBlendAddress, getPermit2Address, getTreasuryAddress} from './addresses'

export default async function deploy(
  params: any,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const ethers = hre.ethers;
  console.log("Deploying JamSettlement...");
  const chainId = (await ethers.provider.getNetwork()).chainId
  const permit2Address = getPermit2Address(chainId)
  const bebopBlendAddress = getBebopBlendAddress(chainId)
  const treasuryAddress = getTreasuryAddress(chainId)
  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(permit2Address, bebopBlendAddress, treasuryAddress);
  console.log("Hash:", settlement.deployTransaction.hash);
  await settlement.deployed();
  console.log("JamSettlement deployed to:", settlement.address);

  const balanceManagerAddress = await settlement.balanceManager();

  console.log({
    "JamSettlement": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}
