import { PublicKey } from '@solana/web3.js'

import { getSolendSupplyAprs } from './solend/index.js'
import { getFundingRates, sizeIncrements } from './ftx/index.js'
import { Token } from './config.js'

const getHighestApr = async () => {
	const solendAprs = await getSolendSupplyAprs()
	const ftxFundingAprs = await getFundingRates()

	if (!ftxFundingAprs) {
		process.exit()
	}

	let highestFtxSymbol: null | string = null
	let highestApr: number | null = null
	let highestToken: Token | null = null
	solendAprs.forEach(({ tokenSymbol, aprPct, tokenDecimals, tokenMint }) => {
		const ftxCurrentApr = ftxFundingAprs.get(tokenSymbol)
		if (!ftxCurrentApr) {
			return
		}
		const totalApr = ftxCurrentApr + aprPct
		if (highestApr === null || totalApr > highestApr) {
			highestApr = totalApr
			highestFtxSymbol = tokenSymbol
			highestToken = {
				mint: new PublicKey(tokenMint),
				decimals: tokenDecimals,
			}
		}
	})

	console.log(`Found highest APR on ${highestFtxSymbol}: ${highestApr}%`)

	return {
		ftxSymbol: highestFtxSymbol!,
		token: highestToken!,
		sizeIncrement: sizeIncrements.get(highestFtxSymbol!)!,
		highestApr: highestApr || 0,
	}
}
