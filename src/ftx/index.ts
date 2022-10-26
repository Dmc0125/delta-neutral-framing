import fetch from 'node-fetch'

const API_ENDPOINT = 'https://ftx-predicted-funding-production.up.railway.app/'

type FundingApiData = Record<string, {
  predictedFunding: number
  lastUpdated: number
}>

type FundingApiResponse = {
  data: FundingApiData | null
}

// Longs pay shorts if positive
export const getFundingRates = async () => {
  try {
    const { data } = await (await fetch(API_ENDPOINT)).json() as FundingApiResponse
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
