import fetch from 'node-fetch'

import { getMarkets } from './api.js'

const API_ENDPOINT = 'https://ftx-predicted-funding-production.up.railway.app/'

type FundingApiData = Record<
	string,
	{
		predictedFunding: number
		lastUpdated: number
	}
>

type FundingApiResponse = {
	data: FundingApiData | null
}

const { data, error } = await getMarkets()
if (!data) {
	throw Error(error || '[FTX ERROR]: Could not fetch markets')
}
export const sizeIncrements = new Map<string, number>()
data.forEach(({ sizeIncrement, name, underlying }) => {
	if (name.endsWith('PERP')) {
		sizeIncrements.set(underlying, sizeIncrement)
	}
})

export const floorBasedOnSizeIncrement = (num: number, increment: number) => 
	Math.floor(num / increment) * increment

// Longs pay shorts if positive
export const getFundingRates = async () => {
	try {
		const { data } = (await (await fetch(API_ENDPOINT)).json()) as FundingApiResponse
		if (data) {
			const fundingAprMap = new Map<string, number>()
			Object.entries(data).forEach(([market, { predictedFunding }]) => {
				const [symbol] = market.split('-')
				fundingAprMap.set(symbol, predictedFunding * 24 * 365)
			})
			return fundingAprMap
		}
		return null
	} catch (error) {
		console.error('[FTX API ERROR]:', error)
		return null
	}
}
