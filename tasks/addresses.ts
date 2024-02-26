function getPermit2Address(chainId: number) {
  if ([137, 1, 42161, 43114, 56, 10].includes(chainId)) {
    return '0x000000000022D473030F116dDEE9F6B43aC78BA3'
  }

  // zksync
  if ([300, 324].includes(chainId)) {
    return '0x0000000000225e31D15943971F47aD3022F714Fa'
  }

  throw new Error("Permit2 address not specified.")
}

function getDaiAddress(chainId: number) {
  switch(chainId) {
    case 1:
      return '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    case 137:
      return '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    case 42161:
      return '0x0000000000000000000000000000000000000000'
    case 43114:
      return '0x0000000000000000000000000000000000000000'
    case 56:
      return '0x0000000000000000000000000000000000000000'
    case 300:
      return '0x0000000000000000000000000000000000000000'
    case 324:
      return '0x0000000000000000000000000000000000000000'
    case 10:
      return '0x0000000000000000000000000000000000000000'
    default:
      throw new Error("Dai address not specified.")
  }
}

export { getPermit2Address, getDaiAddress }