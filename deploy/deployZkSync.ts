import { Wallet, utils } from "zksync-ethers";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import {getBebopBlendAddress, getPermit2Address, getTreasuryAddress} from "../tasks/addresses";

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  if (!PRIVATE_KEY) throw "⛔️ Private key not detected! Include it in ENV.";

  // Initialize the wallet.
  const wallet = new Wallet(PRIVATE_KEY);

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);

  // L2 provider comes from wallet
  const chainId = (await deployer.zkWallet.provider.getNetwork()).chainId;
  if (!chainId) throw "⛔️ Chain ID not detected!";
  const permit2Address = getPermit2Address(chainId)
  const bebopBlendAddress = getBebopBlendAddress(chainId)
  const treasuryAddress = getTreasuryAddress(chainId)


  const artifact = await deployer.loadArtifact("JamSettlement");
  const params = [permit2Address, bebopBlendAddress, treasuryAddress];
  const deploymentFee = await deployer.estimateDeployFee(artifact, params);

  // Deploy this contract. The returned object will be of a `Contract` type, similar to ones in `ethers`.
  // `greeting` is an argument for contract constructor.
  const parsedFee = ethers.utils.formatEther(deploymentFee);
  console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

  const settlement = await deployer.deploy(artifact, params);

  console.log("Hash:", settlement.deployTransaction.hash);
  await settlement.deployed();
  
  console.log("JamSettlement deployed to:", settlement.address);

  const balanceManagerAddress = await settlement.balanceManager();

  //obtain the Constructor Arguments
  console.log("constructor args:" + settlement.interface.encodeDeploy(params));

  console.log({
    "JamSettlement": settlement.address,
    "JamBalanceManager": balanceManagerAddress
  })
}