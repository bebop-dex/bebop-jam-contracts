import { expect } from "chai";
import { ethers } from "hardhat";

describe("JamSolverRegistry", function () {
  it("Should deploy registry", async function () {
    const JamSolverRegistry = await ethers.getContractFactory("JamSolverRegistry")
    const registry = await JamSolverRegistry.deploy();
    await registry.deployed();

    expect(await registry.isAllowed("0x0000000000000000000000000000000000000000")).to.equal(false);
  });
});
