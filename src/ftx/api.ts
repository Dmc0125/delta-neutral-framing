import fetch from 'node-fetch'
import crypto from 'node:crypto'

import { FTX_API_KEY, FTX_API_SECRET, FTX_SUBACCOUNT } from '../env.js'

const API_URL = 'https://ftx.com/api'
const TIME_URL = 'https://otc.ftx.com/api/time'

const ftxTimeDiff = { value: 0 }
export const updateTimeDiff = async () => {
  try {
    const res = await (await fetch(TIME_URL)).json() as Record<string, unknown>
    if ('success' in res && res.success) {
      const ts = new Date(res.result as string)
      ftxTimeDiff.value = ts.getTime() - new Date().getTime()
    }
  } catch (error) {
    console.error(error)
  }
}
await updateTimeDiff()

type FetchMethod = 'GET' | 'POST'

type AuthHeaders = Record<string, string>

const createAuthHeaders = (method: FetchMethod, reqPath: string) => {
  const ts = new Date().getTime() + ftxTimeDiff.value
  const key = `${ts}${method}/api${reqPath}`
  console.log({ key })
  const signature = crypto.createHmac('sha256', FTX_API_SECRET).update(key).digest('hex')
  const headers: AuthHeaders = {
    'FTX-KEY': FTX_API_KEY,
    'FTX-TS': ts.toString(),
    'FTX-SIGN': signature,
  }
  if (FTX_SUBACCOUNT) {
    headers['FTX-SUBACCOUNT'] = encodeURIComponent(FTX_SUBACCOUNT)
  }
  return headers
}

type FtxFetchParams = {
  method: FetchMethod
  endpoint: string
  options?: Record<string, unknown>
  params?: Record<string, string>
}

const ftxFetch = async <ReturnType>({
  method,
  endpoint,
  options,
  params,
}: FtxFetchParams, isPrivate?: boolean) => {
  const optionsBody = options && method === 'POST' ? JSON.stringify(options) : ''
  const optionsParams = params ? `?${new URLSearchParams(params).toString()}` : ''
  const _endpoint = `${endpoint}${optionsParams}`

  let authHeaders: AuthHeaders = {}
  if (isPrivate) {
    authHeaders = createAuthHeaders(method, `${_endpoint}${optionsBody}`)
  }

  try {
    console.log({ _endpoint })
    const res = await (await fetch(`${API_URL}${_endpoint}`, {
      headers: {
        'content-type': 'application/json',
        ...authHeaders,
      },
      body: optionsBody,
      method,
    })).json() as Record<string, unknown>
    if (res.success) {
      return res.result as ReturnType
    }
    console.error(res)
    return null
  } catch (error) {
    console.error(error)
    return null
  }
}

type PlaceOrderParams = {
  symbol: string
  price: number
  size: number
  reduceOnly?: boolean
}

type OrderType = 'limit' | 'market'
type OrderStatus = 'new' | 'open' | 'closed'
type OrderSide = 'sell' | 'buy'

type PlaceOrderResponse = {
  createdAt: string
  filledSize: number
  future: string
  id: number
  market: string
  price: number
  remainingSize: number
  side: OrderSide
  size: number
  status: OrderStatus
  type: OrderType
  reduceOnly: boolean
  ioc: boolean
  postOnly: boolean
  clientId: string | null
}

export const placeOrder = async ({
  symbol,
  price,
  size,
}: PlaceOrderParams) => {
  const endpoint = '/orders'
  const res = await ftxFetch<PlaceOrderResponse>({
    method: 'POST',
    options: {
      market: `${symbol.toUpperCase()}-PERP`,
      side: 'sell',
      type: 'limit',
      price,
      size,
    },
    endpoint,
  }, true)
  return res
}
