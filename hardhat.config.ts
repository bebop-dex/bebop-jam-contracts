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
    scroll: {
      url: "https://rpc.scroll.io",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
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
    },
    mode: {
      url: 'https://mode.drpc.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    base: {
      url: 'https://mainnet.base.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    taiko: {
      url: 'https://rpc.ankr.com/taiko',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    },
    bArtio: {
      url: 'https://bartio.rpc.berachain.com/',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      zksync: false
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.ETHERSCAN_API_KEY!,
      optimisticEthereum: process.env.ETHERSCAN_API_KEY!,
      scroll: process.env.ETHERSCAN_API_KEY!,
      taiko: process.env.ETHERSCAN_API_KEY!,
      mode: "abc",
      bArtio: "abc"
    },
    customChains: [
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.avascan.info/v2/network/mainnet/evm/43114/etherscan",
          browserURL: "https://mainnet.avascan.info/blockchain/mainnet"
        }
      },
      {
        network: "mode",
        chainId: 34443,
        urls: {
          apiURL: "https://explorer.mode.network/api",
          browserURL: "https://explorer.mode.network/"
        }
      },
      {
        network: "scroll",
        chainId: 534352,
        urls: {
          apiURL: "https://api.scrollscan.com/api",
          browserURL: "https://scrollscan.com/"
        }
      },
      {
        network: "taiko",
        chainId: 167000,
        urls: {
          apiURL: "https://api.taikoscan.io/api",
          browserURL: "https://taikoscan.io/"
        }
      },
      {
        network: "bArtio",
        chainId: 80084,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/80084/etherscan/api",
          browserURL: "https://bartio.beratrail.io/"
        }
      }
    ],
  },
};

export default config;
