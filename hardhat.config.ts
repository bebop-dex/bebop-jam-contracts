import fs from "fs";
import "@nomiclabs/hardhat-waffle";
import "@nomicfoundation/hardhat-verify";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter"
import "hardhat-preprocessor";
import { HardhatUserConfig, task } from "hardhat/config";

import deploy from "./tasks/deploy";
import deploySolver from "./tasks/deploySolver";
import deployZkSync from "./deploy/deployZkSync";

const PRIVATE_KEY = process.env.PRIVATE_KEY;

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim().split("="));
}

task("deploy", "Deploy").setAction(deploy);
task("deploySolver", "Deploy Solver").addParam('settlement', 'Jam Settlement Contract Address').setAction(deploySolver);
task("deployZkSync", "Deploy Zk Sync").setAction(deployZkSync);

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.3.22", // Uses latest available in https://github.com/matter-labs/zksolc-bin/
    settings: {
      optimizer: {
        enabled: true,
        mode: 'z', // Optimise for contract size
      }
    },
  },
  typechain: {
    externalArtifacts: [
        "./test/hardhat/bebop/BebopSettlement.json"
    ]
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200000,
      },
      viaIR: true
    },
  },
  paths: {
    sources: "./src", // Use ./src rather than ./contracts as Hardhat expects
    cache: "./cache_hardhat", // Use a different cache for Hardhat than Foundry
  },
  // This fully resolves paths for imports in the ./lib directory for Hardhat
  // @ts-ignore
  preprocess: {
    // @ts-ignore
    eachLine: (hre) => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          getRemappings().forEach(([find, replace]) => {
            if (line.match(find)) {
              line = line.replace(find, replace);
            }
          });
        }
        return line;
      },
    }),
  },
  networks: {
    hardhat: {
      chainId: 1,
      allowUnlimitedContractSize: true,
      zksync: false
    },
    sepolia: {
      url: "https://eth-sepolia.public.blastapi.io",
      zksync: false,
    },
    zkSyncTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification'
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "ethereum",
      zksync: true,
      verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification'
    },
    polygon: {
      url: 'https://polygon.llamarpc.com',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    ethereum: {
      url: 'https://eth.llamarpc.com',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    arbitrum: {
      url: 'https://rpc.ankr.com/arbitrum',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    optimism: {
      url: 'https://optimism.llamarpc.com',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    avalanche: {
      url: 'https://avalanche.drpc.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    bsc: {
      url: 'https://bsc-dataseed3.bnbchain.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    }
  },
  etherscan: {
    apiKey: {
      optimisticEthereum: process.env.ETHERSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.avascan.info/v2/network/mainnet/evm/43114/etherscan",
          browserURL: "https://mainnet.avascan.info/blockchain/mainnet"
        }
      }
    ]
  },
};

export default config;
