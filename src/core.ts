import { setTimeout } from 'node:timers/promises'

import { executeMarketBuy } from './jupiter/index.js'
import { modifyOrder, placeOrder } from './ftx/api.js'
import { subscribeToFills, subscribeToTicker } from './ftx/ws.js'
import { Token, USDC } from './config.js'
import { floorBasedOnSizeIncrement } from './ftx/index.js'

const toRaw = (ui: number, decimals: number) => Math.floor(ui * 10 ** decimals)
const floor = (num: number, decimals: number) => Math.floor(num * 10 ** decimals) / 10 ** decimals

const useHedge = (input: Token, output: Token, totalSizeUi: number) => {
	const totalSizeRaw = toRaw(totalSizeUi, input.decimals)
	let executedRaw = 0
	let toExecuteRaw = 0
	const executing: boolean[] = []

	const intervalId = setInterval(async () => {
		// 99.5% of totalSizeRaw because of FTX rounding
		if (!executing.length && executedRaw >= totalSizeRaw * 0.995) {
			console.log('Counter position successfully opened/closed')
			clearInterval(intervalId)
			return
		}
		if (toExecuteRaw > 0) {
			console.log('Opening/Closing counter position of size:', toExecuteRaw)
			executing.push(true)
			const _toExecuteRaw = toExecuteRaw
			toExecuteRaw = 0
			const txMetaPromise = executeMarketBuy({
				inputMint: input.mint,
				outputMint: output.mint,
				sizeRaw: _toExecuteRaw,
			})
			const txMeta = await txMetaPromise
			if (txMeta) {
				executedRaw += _toExecuteRaw
			} else {
				toExecuteRaw += _toExecuteRaw
			}
			executing.pop()
		}
	}, 5000)

	const add = (sizeUi: number) => {
		toExecuteRaw += toRaw(sizeUi, input.decimals)
	}

	return add
}

const castBaseSizeToQuoteSize = (baseSize: number, basePrice: number, decimals: number) =>
	floor(baseSize * basePrice, decimals)
const castQuoteSizeToBaseSize = (quoteSize: number, basePrice: number, sizeIncrement: number) =>
	floorBasedOnSizeIncrement(quoteSize / basePrice, sizeIncrement)

type HedgedPositionParams = {
	ftxPerpSymbol: string
	ftxSizeIncrement: number
	symbolToken: Token
	usdcSize: number
}

export const openHedgedPosition = async ({
	ftxPerpSymbol,
	ftxSizeIncrement,
	symbolToken,
	usdcSize,
}: HedgedPositionParams) => {
	console.log('Subscribing to websocket feeds')

	const addToHedge = useHedge(USDC, symbolToken, usdcSize)
	let orderId: null | number = null

	let ask = 0
	const tickerUnsub = subscribeToTicker(ftxPerpSymbol, async ({ ask: _ask }) => {
		ask = _ask
	})

	let tokenSize = 0
	let remainingSize = usdcSize
	const fillsUnsub = subscribeToFills(({ size, orderId: fillOrderId, price }) => {
		if (orderId === fillOrderId) {
			tokenSize += size
			const quoteSize = castBaseSizeToQuoteSize(size, price, USDC.decimals)
			remainingSize -= quoteSize
			addToHedge(quoteSize)
		}
	})

	await setTimeout(5000)
	console.log('Placing first order at:', ask)
	const { data: firstOrder } = await placeOrder({
		symbol: ftxPerpSymbol,
		price: ask,
		size: castQuoteSizeToBaseSize(usdcSize, ask, ftxSizeIncrement),
		side: 'sell',
	})
	if (!firstOrder) {
		tickerUnsub()
		fillsUnsub()
		return
	}

	orderId = firstOrder.id
	let lastOrderPrice = firstOrder.price

	const trailOrder = async () => {
		console.log({ remainingSize })
		if (remainingSize <= 0) {
			return
		}
		if (orderId && ask !== lastOrderPrice) {
			console.log('Modifying order at:', ask)
			const { data: modifiedOrder, error } = await modifyOrder({
				id: orderId,
				size: castQuoteSizeToBaseSize(remainingSize, ask, ftxSizeIncrement),
				price: ask,
			})
			if (error === 'Size too small for provide') {
				console.log(error)
				return
			}

			if (modifiedOrder) {
				orderId = modifiedOrder.id
				lastOrderPrice = modifiedOrder.price
			}
		}
		await setTimeout(500)
		await trailOrder()
	}

	await trailOrder()

	tickerUnsub()
	fillsUnsub()

	console.log('Successfully opened hedged position of size:', tokenSize)
	return tokenSize
}

type CloseHedgedPositionParams = {
	ftxPerpSymbol: string
	symbolToken: Token
	openedPositionSize: number
}

export const closeHedgedPosition = async ({
	ftxPerpSymbol,
	symbolToken,
	openedPositionSize,
}: CloseHedgedPositionParams) => {
	console.log('Subscribing to websocket feeds')
	let bid = 0
	const unsubTicker = subscribeToTicker(ftxPerpSymbol, ({ bid: _bid }) => {
		bid = _bid
	})

	let remainingSymbolSize = openedPositionSize
	let orderId: number | null = null

	const addToHedge = useHedge(symbolToken, USDC, remainingSymbolSize)
	const unsubFills = subscribeToFills(({ size: tokenSize, orderId: _orderId }) => {
		if (_orderId === orderId) {
			addToHedge(tokenSize)
			remainingSymbolSize -= tokenSize
		}
	})

	await setTimeout(5000)

	console.log('Placing first order')
	const { data: firstOrder } = await placeOrder({
		symbol: ftxPerpSymbol,
		price: bid,
		size: remainingSymbolSize,
		side: 'buy',
		reduceOnly: true,
	})

	if (!firstOrder) {
		unsubTicker()
		unsubFills()
		return
	}

	orderId = firstOrder.id
	let lastOrderPrice = firstOrder.price

	const trailOrder = async () => {
		if (remainingSymbolSize === 0) {
			return
		}
		if (lastOrderPrice !== bid && orderId) {
			console.log('Modifying order at:', bid)
			const { data: modifiedOrder, error } = await modifyOrder({
				id: orderId,
				size: remainingSymbolSize,
				price: bid,
			})
			if (error === 'Size too small for provide') {
				console.log(error)
				return
			}
			if (modifiedOrder) {
				orderId = modifiedOrder.id
				lastOrderPrice = modifiedOrder.price
			}
		}
		await setTimeout(500)
		trailOrder()
	}

	await trailOrder()

	unsubTicker()
	unsubFills()
}
