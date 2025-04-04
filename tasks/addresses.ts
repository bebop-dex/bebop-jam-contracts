function getPermit2Address(chainId: number) {
  if ([137, 1, 42161, 43114, 56, 10, 34443, 8453, 534352, 167000, 81457, 6342, 5330].includes(chainId)) {
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
  if ([137, 1, 42161, 56, 10, 8453, 167000, 81457, 534352, 34443, 6342, 5330].includes(chainId)) {
    return '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F'
  }
  if ([324].includes(chainId)) {
    return '0x1e45bF85f36c257B7fDdAa5b17c1730aB37ba7d0'
  }
  throw new Error("BebopBlend address not specified.")
}

function getTreasuryAddress(_chainId: number): string {
  return "0x1af49c826Ea0A8F29ea448f2171D1BCb716cB22D"
}

export { getPermit2Address, getBebopBlendAddress, getTreasuryAddress }