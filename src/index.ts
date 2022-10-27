import { getSolendSupplyAprs } from './solend/index.js'
import { getFundingRates } from './ftx/index.js'

const solendAprs = await getSolendSupplyAprs()
const ftxFundingAprs = await getFundingRates()

if (!ftxFundingAprs) {
	process.exit()
}

let highestDiffSymbol: null | string = null
let highestApr: number | null = null
solendAprs.forEach(({ symbol, aprPct }) => {
	const ftxCurrentApr = ftxFundingAprs.get(symbol)
	if (!ftxCurrentApr) {
		return
	}
	const totalApr = ftxCurrentApr + aprPct
	if (highestApr === null || totalApr > highestApr) {
		highestApr = totalApr
		highestDiffSymbol = symbol
	}
})

console.log({
	highestDiffSymbol,
	highestApr,
})
