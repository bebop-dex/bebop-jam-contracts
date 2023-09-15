import {ethers, network} from "hardhat";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  BINANCE_ADDRESS,
  ETH_FOR_BLOCK,
  ETH_RPC,
  NFT_COLLECTOR,
  NFTS_ERC1155,
  NFTS_ERC721,
  PERMIT2_ADDRESS,
  TOKENS
} from "../config";


async function getFunds(walletsWithFunds: SignerWithAddress[], solverAddr: string){
  let amount = ethers.utils.parseEther("90") // ETH
  for (let wallet of walletsWithFunds) {
    // Get 90 WETH
    await wallet.sendTransaction({
      to: TOKENS.WETH,
      value: amount
    })
    let WETH_Contract = await ethers.getContractAt("IERC20", TOKENS.WETH)
    expect(await WETH_Contract.balanceOf(wallet.address)).to.equal(amount);

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
  const getReceiverAddress = (to: string) => {
    if (to === "solver") return solverAddr;
    if (to === "taker") return walletsWithFunds[0].address;
    if (to === "maker") return walletsWithFunds[2].address;
    return ""
  }
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [NFT_COLLECTOR],
  });
  for (let token of Object.values(NFTS_ERC721)) {
    const binance = await ethers.provider.getSigner(NFT_COLLECTOR);
    let tokenContract = await ethers.getContractAt("IERC721", token.address)
    let receiver = getReceiverAddress(token.to)
    await tokenContract.connect(binance).transferFrom(NFT_COLLECTOR, receiver, token.id);
    expect(await tokenContract.balanceOf(receiver)).to.equal(1);
  }
  for (let token of Object.values(NFTS_ERC1155)) {
    const binance = await ethers.provider.getSigner(NFT_COLLECTOR);
    let tokenContract = await ethers.getContractAt("IERC1155", token.address)
    let receiver = getReceiverAddress(token.to)
    await tokenContract.connect(binance).safeTransferFrom(NFT_COLLECTOR, receiver, token.id, token.amount, "0x");
    expect(await tokenContract.balanceOf(receiver, token.id)).to.equal(token.amount);
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

  const [deployer, solver, user, bebopMaker, directMaker, ...users] = await ethers.getSigners();

  const JamSettlement = await ethers.getContractFactory("JamSettlement");
  const settlement = await JamSettlement.deploy(PERMIT2_ADDRESS, TOKENS.DAI);
  await settlement.deployed();

  const JamSolver = await ethers.getContractFactory("JamSolver");
  const solverContract = await JamSolver.connect(solver).deploy(settlement.address);
  await solverContract.deployed();

  const balanceManagerAddress = await settlement.balanceManager();
  const JamBalanceManager = await ethers.getContractFactory("JamBalanceManager");
  const balanceManager = await JamBalanceManager.attach(balanceManagerAddress);

  let walletsWithFunds = [user, bebopMaker, directMaker, solver]
  await getFunds(walletsWithFunds, solverContract.address)
  console.log("User", user.address)
  console.log("BebopMaker", bebopMaker.address)
  console.log("DirectMaker", directMaker.address)
  console.log("SolverContract", solverContract.address)
  console.log("BalanceManager", balanceManager.address)
  console.log("Settlement", settlement.address)

  return {
    deployer,
    solver,
    solverContract,
    user,
    bebopMaker,
    settlement,
    balanceManager,
    directMaker
  }
}