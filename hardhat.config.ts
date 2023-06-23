import fs from "fs";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-preprocessor";
import { HardhatUserConfig, task } from "hardhat/config";

import deploy from "./tasks/deploy";
import addSolver from "./tasks/addSolver";

const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY;

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim().split("="));
}

task("deploy", "Deploy").setAction(deploy);
task("addSolver", "Add Solver").addParam('registryAddress').addParam('solverAddress').setAction(addSolver);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src", // Use ./src rather than ./contracts as Hardhat expects
    cache: "./cache_hardhat", // Use a different cache for Hardhat than Foundry
  },
  // This fully resolves paths for imports in the ./lib directory for Hardhat
  preprocess: {
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
      forking: {
        url: 'https://polygon-mainnet.g.alchemy.com/v2/Q39gdiKfeBSD5lr30t-OJQzl5VIgbwVR'
      }
    },
    polygon: {
      url: 'https://polygon-mainnet.g.alchemy.com/v2/Q39gdiKfeBSD5lr30t-OJQzl5VIgbwVR',
      accounts: POLYGON_PRIVATE_KEY ? [POLYGON_PRIVATE_KEY] : undefined
    }
  }
};

export default config;
