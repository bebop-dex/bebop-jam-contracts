// ETH Tokens
export const TOKENS = {
    "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "LINK": "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    "YFI": "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
    "MKR": "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
}

export const NFTS_ERC721 = {
    "bayc": {
        "to": "solver",
        "address": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
        "id": 848
    },
    "coolcats": {
        "to": "taker",
        "address": "0x1A92f7381B9F03921564a437210bB9396471050C",
        "id": 4247
    },
    "ens": {
        "to": "maker",
        "address": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "id": "114216472655894305947166308178921433071872633673493672484331688528898546248521"
    }

}

export const NFTS_ERC1155 = {
    "opensea": {
        "to": "solver",
        "address": "0x495f947276749Ce646f68AC8c248420045cb7b5e",
        "id": "5013177283398590222279544863910203618869221655136791579052742559679025088160",
        "amount": 2
    },
    "rtfkt": {
        "to": "taker",
        "address": "0x6d4bbC0387dD4759EEe30f6A482AC6dC2Df3Facf",
        "id": "1",
        "amount": 1
    },
    "ronin": {
        "to": "maker",
        "address": "0x497a9A79e82e6fC0FF10a16f6F75e6fcd5aE65a8",
        "id": "4501",
        "amount": 1
    }
}

export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3"
export const BINANCE_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60"
export const NFT_COLLECTOR = "0x54BE3a794282C030b15E43aE2bB182E14c409C5e"

export const ETH_RPC = "https://rpc.ankr.com/eth"
export const ETH_FOR_BLOCK = 17719907