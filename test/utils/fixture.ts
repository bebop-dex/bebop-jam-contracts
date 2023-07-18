import {ethers, network} from "hardhat";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BINANCE_ADDRESS, ETH_FOR_BLOCK, ETH_RPC, PERMIT2_ADDRESS, TOKENS} from "../config";


async function getFunds(walletsWithFunds: SignerWithAddress[]){
  let amount = ethers.utils.parseEther("100") // ETH
  for (let wallet of walletsWithFunds) {
    // Get 100 WETH
    await wallet.sendTransaction({
      to: TOKENS.WETH,
      value: amount
    })
    let WETH_Contract = await ethers.getContractAt("ERC20", TOKENS.WETH)
    expect(await WETH_Contract.balanceOf(wallet.address)).to.equal(amount);

    // Get other tokens
    for (let token of Object.values(TOKENS)) {
      if (token === TOKENS.WETH) continue;
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [BINANCE_ADDRESS],
      });
      const binance = await ethers.provider.getSigner(BINANCE_ADDRESS);
      let tokenContract = await ethers.getContractAt("ERC20", token)
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

  const [deployer, solver, user, bebopMaker, ...users] = await ethers.getSigners();

  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(PERMIT2_ADDRESS);
  await settlement.deployed();

  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.connect(solver).deploy(settlement.address);
  await solverContract.deployed();

  const balanceManagerAddress = await settlement.balanceManager();
  const JamBalanceManager = await ethers.getContractFactory("JamBalanceManager");
  const balanceManager = await JamBalanceManager.attach(balanceManagerAddress);

  let walletsWithFunds = [user, bebopMaker]
  await getFunds(walletsWithFunds)
  console.log("User", user.address)
  console.log("BebopMaker", bebopMaker.address)
  console.log("SolverContract", solverContract.address)

  return {
    deployer,
    solver,
    solverContract,
    user,
    bebopMaker,
    settlement,
    balanceManager
  }
}