import {ethers, network, waffle} from "hardhat";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  BINANCE_ADDRESS,
  ETH_FOR_BLOCK,
  ETH_RPC,
  PERMIT2_ADDRESS,
  TOKENS
} from "../config";
import BebopSettlementABI from "../blend/BebopSettlement.json";
import SmartWalletABI from "./EIP1271Wallet.json";
import {BebopSettlement} from "../../../typechain-types";
import {EIP1271Wallet} from "../../../typechain-types";


async function getFunds(walletsWithFunds: (SignerWithAddress | EIP1271Wallet)[]){
  let amount = ethers.utils.parseEther("90") // ETH
  for (let wallet of walletsWithFunds) {
    // Get 90 WETH
    if (wallet instanceof SignerWithAddress) {
      await wallet.sendTransaction({
        to: TOKENS.WETH,
        value: amount
      })
      let WETH_Contract = await ethers.getContractAt("IERC20", TOKENS.WETH)
      expect(await WETH_Contract.balanceOf(wallet.address)).to.equal(amount);
    }

    // Get other tokens
    for (let token of Object.values(TOKENS)) {
      if (token === TOKENS.WETH || token === TOKENS.ETH) continue;
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [BINANCE_ADDRESS],
      });
      const binance = await ethers.provider.getSigner(BINANCE_ADDRESS);
      let tokenContract = await ethers.getContractAt("IERC20", token)
      let tokenBalance = (await tokenContract.balanceOf(BINANCE_ADDRESS)).div(5)
      expect(tokenBalance).to.be.gt(0);
      await tokenContract.connect(binance).transfer(wallet.address, tokenBalance.toString());
      expect(await tokenContract.balanceOf(wallet.address)).to.equal(tokenBalance);
    }
  }
}

export async function getFixture () {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: ETH_RPC,
          blockNumber: ETH_FOR_BLOCK,
        },
      },
    ],
  });

  const [deployer, solver, executor, user, anotherUser, bebopMaker, bebopMaker2, bebopMaker3, directMaker, treasuryAddress,, ...users] = await ethers.getSigners();

  const bebopBlend = await waffle.deployContract(deployer, BebopSettlementABI, [
    TOKENS.WETH,
    PERMIT2_ADDRESS,
    TOKENS.DAI
  ]) as BebopSettlement;

  const takerSmartWallet = await waffle.deployContract(deployer, SmartWalletABI, []) as EIP1271Wallet;

  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(PERMIT2_ADDRESS, bebopBlend.address, treasuryAddress.address);
  await settlement.deployed();

  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.connect(solver).deploy(settlement.address);
  await solverContract.deployed();

  const balanceManagerAddress = await settlement.balanceManager();
  const JamBalanceManager = await ethers.getContractFactory("JamBalanceManager");
  const balanceManager = await JamBalanceManager.attach(balanceManagerAddress);

  let walletsWithFunds = [user, anotherUser, bebopMaker, bebopMaker2, bebopMaker3, directMaker, solver, takerSmartWallet]
  await getFunds(walletsWithFunds)
  // console.log("User", user.address)
  // console.log("BebopMaker", bebopMaker.address)
  // console.log("DirectMaker", directMaker.address)
  // console.log("SolverContract", solverContract.address)
  // console.log("BalanceManager", balanceManager.address)
  // console.log("BebopBlend", bebopBlend.address)
  // console.log("Settlement", settlement.address)

  return {
    deployer,
    solver,
    executor,
    solverContract,
    user,
    anotherUser,
    bebopMaker,
    bebopMaker2,
    bebopMaker3,
    settlement,
    balanceManager,
    directMaker,
    bebopBlend,
    treasuryAddress,
    takerSmartWallet
  }
}