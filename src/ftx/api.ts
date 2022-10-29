import fetch from 'node-fetch'
import crypto from 'node:crypto'

import { FTX_API_KEY, FTX_API_SECRET, FTX_SUBACCOUNT } from '../env.js'

const API_URL = 'https://ftx.com/api'
const TIME_URL = 'https://otc.ftx.com/api/time'

const ftxTimeDiff = { value: 0 }
export const updateTimeDiff = async () => {
	try {
		const res = (await (await fetch(TIME_URL)).json()) as Record<string, unknown>
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

type FtxApiResponse<T> =
	| {
			success: true
			result: T
	  }
	| {
			success: false
			error: string
	  }

const ftxFetch = async <ReturnType>(
	{ method, endpoint, options, params }: FtxFetchParams,
	isPrivate?: boolean,
) => {
	const optionsBody = options && method === 'POST' ? JSON.stringify(options) : ''
	const optionsParams = params ? `?${new URLSearchParams(params).toString()}` : ''
	const _endpoint = `${endpoint}${optionsParams}`

	let authHeaders: AuthHeaders = {}
	if (isPrivate) {
		authHeaders = createAuthHeaders(method, `${_endpoint}${optionsBody}`)
	}

	try {
		console.log({ _endpoint })
		const res = (await (
			await fetch(`${API_URL}${_endpoint}`, {
				headers: {
					'content-type': 'application/json',
					...authHeaders,
				},
				body: optionsBody.length ? optionsBody : undefined,
				method,
			})
		).json()) as FtxApiResponse<ReturnType>
		if (res.success) {
			return {
				success: true,
				data: res.result as ReturnType,
			}
		}
		console.error(res)
		return {
			success: false,
			error: res.error,
		}
	} catch (error) {
		console.error(error)
		return {
			success: false,
		}
	}
}

export type OrderSide = 'sell' | 'buy'

type PlaceOrderParams = {
	symbol: string
	price: number
	size: number
	reduceOnly?: boolean
	side: OrderSide
}

type OrderType = 'limit' | 'market'
type OrderStatus = 'new' | 'open' | 'closed'

type OrderResponse = {
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

export const placeOrder = async ({ symbol, price, size, side, reduceOnly }: PlaceOrderParams) => {
	const endpoint = '/orders'
	const res = await ftxFetch<OrderResponse>(
		{
			method: 'POST',
			options: {
				market: `${symbol.toUpperCase()}-PERP`,
				type: 'limit',
				reduceOnly,
				side,
				price,
				size,
			},
			endpoint,
		},
		true,
	)
	return res
}

type ModifyOrderParams = {
	id: number
	size: number
	price: number
}

export const modifyOrder = async ({ id, size, price }: ModifyOrderParams) => {
	const endpoint = `/orders/${id}/modify`
	const res = await ftxFetch<OrderResponse>(
		{
			method: 'POST',
			endpoint,
			options: {
				size,
				price,
			},
		},
		true,
	)
	return res
}

type MarketsResponse = {
	name: string
	baseCurrency: string | null
	quoteCurrency: string | null
	quoteVolume24h: number
	change1h: number
	change24h: number
	changeBod: number
	highLeverageFeeExempt: boolean
	minProvideSize: number
	type: 'future' | 'spot'
	underlying: string
	enabled: boolean
	ask: number
	bid: number
	last: number
	postOnly: boolean
	price: number
	priceIncrement: number
	sizeIncrement: number
	restricted: boolean
	volumeUsd24h: number
	largeOrderThreshold: number
	isEtfMarket: boolean
}

export const getMarkets = async () => {
	const endpoint = '/markets'
	const res = await ftxFetch<MarketsResponse[]>({ endpoint, method: 'GET' })
	return res
}
