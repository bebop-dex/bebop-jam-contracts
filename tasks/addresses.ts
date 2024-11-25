function getPermit2Address(chainId: number) {
  if ([137, 1, 42161, 43114, 56, 10, 34443, 8453, 534352, 167000].includes(chainId)) {
    return '0x000000000022D473030F116dDEE9F6B43aC78BA3'
  }

  // zksync
  if ([300, 324].includes(chainId)) {
    return '0x0000000000225e31D15943971F47aD3022F714Fa'
  }

  if (chainId === 80084) {
    return "0xA4Bf80b2CFBd80C00cB0Cc3d74C8762Ff4762770"
  }

  throw new Error("Permit2 address not specified.")
}

function getBebopBlendAddress(chainId: number) {
  if ([137, 1, 42161, 56, 10, 8453, 167000].includes(chainId)) {
    return '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F'
  }
  throw new Error("BebopBlend address not specified.")
}

function getTreasuryAddress(chainId: number): string {
  throw new Error("Treasury address not specified.")
}

export { getPermit2Address, getBebopBlendAddress , getTreasuryAddress}