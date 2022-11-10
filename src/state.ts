import { Redis } from '@upstash/redis/with-fetch'

import { Token } from './config.js'
import { REDIS_TOKEN, REDIS_URL } from './env.js'

const redis = new Redis({
  url: REDIS_URL,
  token: REDIS_TOKEN,
})

export type Position = {
  symbol: string
  poolAddress: string
  amountRaw: number
  symbolToken: Token
}

const positionStringified = await redis.get<string>('currentPosition')

export const currentPosition = (() => {
  if (!positionStringified) {
    return null
  }
  try {
    return JSON.parse(positionStringified) as Position
  } catch (error) {
    return null
  }
})()

export const setPosition = async ({
  symbol,
  poolAddress,
  amountRaw,
  symbolToken,
}: Position) => {
  await redis.set('currentPosition', JSON.stringify({
    symbol,
    poolAddress,
    amountRaw,
    symbolToken,
  }))
}
