import { PublicKey } from '@solana/web3.js'
import { parseReserve } from '@solendprotocol/solend-sdk'

import { connection } from '../config.js'
import { fetchPools } from './api.js'
import { calculateSupplyApr } from './helpers.js'

type ReserveInfo = {
	poolName: string
	tokenSymbol: string
}

export const getBaseSupplyApr = async () => {
  const pools = await fetchPools()

  const accounts: PublicKey[] = []
  const reservesInfo: ReserveInfo[] = []
  pools.forEach(({ name, reserves }) => {
    reserves.forEach((res) => {
      accounts.push(new PublicKey(res.address))
      reservesInfo.push({
        tokenSymbol: res.liquidityToken.symbol,
        poolName: name,
      })
    })
  })

  const accountsInfo = await connection.getMultipleAccountsInfo(accounts)
  const parsedReservesData = accountsInfo.map((ai, i) => {
    const currentInfo = reservesInfo[i]
    if (!ai) {
      throw Error(`Missing account info for: ${currentInfo.tokenSymbol} from pool ${currentInfo.poolName}`)
    }
    const { tokenSymbol, poolName } = currentInfo
    const parsed = parseReserve(accounts[i], ai)
    if (!parsed) {
      throw Error(`Could not parse account info for: ${currentInfo.tokenSymbol} from pool ${currentInfo.poolName}`)
    }
    return {
      supplyApr: calculateSupplyApr(parsed.info),
      tokenSymbol,
      poolName,
    }
  })
  return parsedReservesData
}
