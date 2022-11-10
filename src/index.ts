import { PublicKey } from '@solana/web3.js'

import { getSolendSupplyAprs } from './solend/index.js'
import { getFundingRates, sizeIncrements } from './ftx/index.js'
import { Token } from './config.js'
import { currentPosition, setPosition } from './state.js'
import { openHedgedPosition } from './position.js'
import { depositToSolend } from './solend/transactions.js'
import { disconnectWebsocket } from './ftx/ws.js'

type HighestAprTokenData = {
	apr: number
	symbol: string
	token: Token
	poolAddress: PublicKey
}

const getHighestAprData = async () => {
	const solendAprs = await getSolendSupplyAprs()
	const ftxFundingAprs = await getFundingRates()

	if (!ftxFundingAprs) {
		process.exit()
	}

	let highestAprTokenData: HighestAprTokenData | null = null
	solendAprs.forEach(({ tokenSymbol, aprPct, tokenDecimals, tokenMint, poolAddress }) => {
		const ftxCurrentApr = ftxFundingAprs.get(tokenSymbol)
		if (!ftxCurrentApr) {
			return
		}
		const totalApr = ftxCurrentApr + aprPct
		if (highestAprTokenData === null || highestAprTokenData.apr < totalApr) {
			highestAprTokenData = {
				apr: totalApr,
				symbol: tokenSymbol,
				token: { mint: new PublicKey(tokenMint), decimals: tokenDecimals },
				poolAddress,
			}
		}
	})

	if (highestAprTokenData === null) {
		throw Error('[FIND_HIGHEST_APR]: Could not find APR results')
	}

	return highestAprTokenData as HighestAprTokenData
}

const highestAprData = await getHighestAprData()
console.info(`Highest APR:  ${highestAprData.symbol} - ${highestAprData.apr}%`)

if (!currentPosition && highestAprData.apr > 14) {
	const { token, symbol, poolAddress } = highestAprData
	const positionData = await openHedgedPosition({
		usdcSize: 20,
		symbolToken: token,
		ftxPerpSymbol: symbol,
		ftxSizeIncrement: sizeIncrements.get(symbol)!,
	})
	if (positionData) {
		await depositToSolend({
			amountRaw: positionData.jupiterAmountRaw,
			symbol,
			poolAddress,
		})
		await setPosition({
			symbol,
			poolAddress: poolAddress.toString(),
			amountRaw: positionData.jupiterAmountRaw,
			symbolToken: token,
		})
	}
}

disconnectWebsocket()
