const hre = require("hardhat");


// An example of a deploy script that will deploy and call a simple contract.
async function verify() {

    const contractAddress = "0xB2Ef53BE5b9E7DF7754C3B9fa8218A6F7935389F";
    const contractFullyQualifiedName = "src/JamSettlement.sol:JamSettlement";
    const constructorArguments = [
        "0x0000000000225e31D15943971F47aD3022F714Fa",
        "0x1e45bF85f36c257B7fDdAa5b17c1730aB37ba7d0",
        "0x1af49c826Ea0A8F29ea448f2171D1BCb716cB22D"
    ];

    const verificationId = await hre.run("verify:verify", {
      address: contractAddress,
      contract: contractFullyQualifiedName,
      constructorArguments: constructorArguments,
    });

    console.log(`Verification ID: ${verificationId}`);
}
verify()