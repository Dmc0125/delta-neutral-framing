import { Reserve, WAD } from '@solendprotocol/solend-sdk'
import BigNumber from 'bignumber.js'

// This code was inspired by Solend
// https://github.com/solendprotocol/public/blob/0b1a0c3bb0ff6e707e2aced5f8ce05fecef2c938/solend-sdk/src/classes/reserve.ts#L59
const calculateUtilizationRatio = (reserve: Reserve) => {
	const totalBorrowsWads = new BigNumber(reserve.liquidity.borrowedAmountWads.toString()).dividedBy(
		WAD,
	)
	return totalBorrowsWads
		.dividedBy(totalBorrowsWads.plus(reserve.liquidity.availableAmount.toString()))
		.toNumber()
}

export const calculateBorrowAPR = (reserve: Reserve) => {
	const currentUtilization = calculateUtilizationRatio(reserve)
	const optimalUtilization = reserve.config.optimalUtilizationRate / 100

	if (optimalUtilization === 1.0 || currentUtilization < optimalUtilization) {
		const normalizedFactor = currentUtilization / optimalUtilization
		const optimalBorrowRate = reserve.config.optimalBorrowRate / 100
		const minBorrowRate = reserve.config.minBorrowRate / 100
		return normalizedFactor * (optimalBorrowRate - minBorrowRate) + minBorrowRate
	} else {
		const normalizedFactor = (currentUtilization - optimalUtilization) / (1 - optimalUtilization)
		const optimalBorrowRate = reserve.config.optimalBorrowRate / 100
		const maxBorrowRate = reserve.config.maxBorrowRate / 100
		return normalizedFactor * (maxBorrowRate - optimalBorrowRate) + optimalBorrowRate
	}
}

export const calculateSupplyApr = (reserve: Reserve) => {
  const currentUtilization = calculateUtilizationRatio(reserve)
  const borrowAPR = calculateBorrowAPR(reserve)
  return currentUtilization * borrowAPR * (1 - reserve.config.protocolTakeRate / 100)
}
