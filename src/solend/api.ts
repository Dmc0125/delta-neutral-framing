import { ExternalRewardStatType, MarketConfigType } from '@solendprotocol/solend-sdk'
import fetch from 'node-fetch'

const SOLEND_API = 'https://api.solend.fi'
const ALLOWED_POOLS = [
	// MAIN
	'4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY',
	// STEPN
	'BjsAGLZzAgBUsiaTTDQv7PWDUDL9dQfKvYwb4q6FoDuD',
	// NAZARE
	'3HGyDbSY5JJRcx1ZXJ2xqxqXJHcKEjBhLmks8th36fQ9',
	// KAMINO
	'Epa6Sy5rhxCxEdmYu6iKKoFjJamJUJw8myjxuhfX2YJi',
	// COIN98
	'7tiNvRHSjYDfc6usrWnSNPyuN68xQfKs1ZG2oqtR5F46',
	// STAR ATLAS
	'99S4iReDsyxKDViKdXQKWDcB6C3waDmfPWWyb5HAbcZF',
]

export const fetchPools = async () => {
	const allConfigs = (await (
		await fetch(`${SOLEND_API}/v1/markets/configs?scope=all&deployment=production`)
	).json()) as (MarketConfigType & { isPermissionless: boolean })[]
	const filtered = allConfigs.filter(({ address }) => ALLOWED_POOLS.includes(address))
	return filtered
}

export const fetchExternalRewards = async () => {
	const data = (await (
		await fetch(`${SOLEND_API}/liquidity-mining/external-reward-stats-v2?flat=true`)
	).json()) as ExternalRewardStatType[]
	console.log(data)
}
