function getPermit2Address(chainId: number) {
  if ([137, 1, 42161].includes(chainId)) {
    return '0x000000000022D473030F116dDEE9F6B43aC78BA3'
  }

  throw new Error("Permit2 address not specified.")
}

function getDaiAddress(chainId: number) {
  switch(chainId) {
    case 1:
      return '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    case 137:
      return '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    default:
      return '0x0000000000000000000000000000000000000000'
  }
}

export { getPermit2Address, getDaiAddress }