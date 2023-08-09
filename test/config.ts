// ETH Tokens
export const TOKENS = {
    "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
}

export const NFTS_ERC721 = {
    "pLoot": {
        "to": "solver",
        "address": "0x03Ea00B0619e19759eE7ba33E8EB8E914fbF52Ea",
        "id": 22170
    },
    "Card": {
        "to": "taker",
        "address": "0xc371DC25bBC88bFD84F02a36389F39a860963315",
        "id": 129
    }
}

export const NFTS_ERC1155 = {
    "opensea": {
        "to": "solver",
        "address": "0x495f947276749Ce646f68AC8c248420045cb7b5e",
        "id": "66012365442667594793692056068446219414163776032110747404787243868486136496197",
        "amount": 2
    },
    "hub": {
        "to": "taker",
        "address": "0xEb59F3e65190C07379252E1910656d75C753C9A9",
        "id": "0",
        "amount": 1
    }
}

export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3"
export const BINANCE_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60"

export const ETH_RPC = "https://rpc.ankr.com/eth"
export const ETH_FOR_BLOCK = 17719907