import { PublicKey } from '@solana/web3.js'
import { parseReserve, Reserve, WAD, WANG } from '@solendprotocol/solend-sdk'
import BigNumber from 'bignumber.js'
import { BN } from 'bn.js'

import { connection } from '../config.js'
import { fetchExternalRewards, fetchPools, fetchTokenPrices } from './api.js'
import { calculateSupplyApr } from './helpers.js'

type ReserveInfo = {
	poolName: string
	poolAddress: PublicKey
	tokenSymbol: string
	tokenMint: string
}

const createKey = (poolName: string, reserveTokenSymbol: string) =>
	`${poolName}-${reserveTokenSymbol}`

type TotalSupplyApr = {
	symbol: string
	pool: string
	aprPct: number
}

export const getSolendSupplyAprs = async () => {
	const pools = await fetchPools()

	// Parse accounts to fetch reserves info
	const accounts: PublicKey[] = []
	const reservesInfo: ReserveInfo[] = []
	pools.forEach(({ name, reserves, address }) => {
		reserves.forEach((res) => {
			accounts.push(new PublicKey(res.address))
			reservesInfo.push({
				poolName: name,
				poolAddress: new PublicKey(address),
				tokenMint: res.liquidityToken.mint,
				tokenSymbol: res.liquidityToken.symbol,
			})
		})
	})

	// Fetch resources
	const [accountsInfo, mostRecentSlot, externalRewards] = await Promise.all([
		connection.getMultipleAccountsInfo(accounts),
		connection.getSlot('finalized'),
		fetchExternalRewards(),
	])

	// TODO: Somehow APRs are slightly higher than displayed on Solend, try to fix if possible
	const baseSupplyApr = new Map<string, number>()
	const parsedReservesData: ({
		parsedReserve: Reserve
		reserveAddress: PublicKey
	} & ReserveInfo)[] = []

	// Parse reserves and calculate base APRs
	accountsInfo.forEach((ai, i) => {
		const { tokenSymbol, poolName, poolAddress } = reservesInfo[i]
		if (!ai) {
			throw Error(`Missing account info for: ${tokenSymbol} from pool ${poolName}`)
		}
		const parsed = parseReserve(poolAddress, ai)
		if (!parsed) {
			throw Error(`Could not parse account info for: ${tokenSymbol} from pool ${poolName}`)
		}
		const supplyAprRaw = calculateSupplyApr(parsed.info)
		const supplyAprPct = Number((supplyAprRaw * 100).toFixed(4))
		baseSupplyApr.set(createKey(poolName, tokenSymbol), supplyAprPct)

		parsedReservesData.push({
			parsedReserve: parsed.info,
			reserveAddress: accounts[i],
			...reservesInfo[i],
		})
	})

	const rewardSymbols: string[] = []
	const rewardsData = new Map<string, { rate: string; symbol: string }[]>()
	externalRewards.forEach((current) => {
		let latest = {
			beginningSlot: 0,
			rewardRate: '0',
			name: 'zero',
		}
		current.rewardRates.forEach((rewardRates) => {
			if (rewardRates.beginningSlot > mostRecentSlot) {
				return
			}
			if (rewardRates.beginningSlot > latest.beginningSlot) {
				latest = rewardRates
			}
		})
		if (!rewardSymbols.includes(current.rewardSymbol)) {
			rewardSymbols.push(current.rewardSymbol)
		}
		rewardsData.set(current.reserveID, [
			...(rewardsData.get(current.reserveID) || []),
			{ rate: latest.rewardRate, symbol: current.rewardSymbol },
		])
	})

	// Fetch token prices
	const tokenPrices = await fetchTokenPrices([
		...new Set([...reservesInfo.map(({ tokenSymbol }) => tokenSymbol), ...rewardSymbols]),
	])

	const calculateRewardApy = (
		rewardRate: string,
		poolSize: string,
		rewardPrice: string,
		tokenPrice: string,
		decimals: number,
	) => {
		const poolValueUSD = new BigNumber(poolSize)
			.times(tokenPrice)
			.dividedBy('1'.concat(Array(decimals + 1).join('0')))
			.dividedBy(WAD)
		return new BigNumber(rewardRate)
			.multipliedBy(rewardPrice)
			.dividedBy(poolValueUSD)
			.dividedBy(WANG)
	}

	// Calculate rewards APR and total APR
	const totalSupplyApr: TotalSupplyApr[] = [...baseSupplyApr].map(([key, aprPct]) => {
		const [pool, symbol] = key.split('-')
		return { pool, symbol, aprPct }
	})
	// const totalSupplyApr = new Map<string, number>([...baseSupplyApr])
	parsedReservesData.forEach(({ parsedReserve, reserveAddress, tokenSymbol, poolName }) => {
		const currentReserveRewards = rewardsData.get(reserveAddress.toString())
		if (!currentReserveRewards) {
			return
		}
		const totalBorrowsWads = parsedReserve.liquidity.borrowedAmountWads
		const totalLiquidityWads = parsedReserve.liquidity.availableAmount.mul(new BN(WAD))
		const totalDepositsWads = totalBorrowsWads.add(totalLiquidityWads)

		const reserveTokenPrice = tokenPrices.get(tokenSymbol)!
		const apys = currentReserveRewards.map(({ rate, symbol }) => {
			const rewardTokenPrice = tokenPrices.get(symbol)
			if (!rewardTokenPrice) {
				return new BigNumber(0)
			}
			return calculateRewardApy(
				rate,
				totalDepositsWads.toString(),
				rewardTokenPrice,
				reserveTokenPrice,
				parsedReserve.liquidity.mintDecimals,
			)
		})
		const totalRewardsApy = apys.reduce((total, current) => total + Number(current.toString()), 0)
		const totalRewardsApyPct = Number((totalRewardsApy * 100).toFixed(4))

		const key = createKey(poolName, tokenSymbol)
		totalSupplyApr.push({
			symbol: tokenSymbol,
			pool: poolName,
			aprPct: baseSupplyApr.get(key)! + totalRewardsApyPct,
		})
	})

	return totalSupplyApr
}
