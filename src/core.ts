import { setTimeout } from 'node:timers/promises'

import { executeMarketBuy } from './jupiter/index.js'
import { modifyOrder, OrderSide, placeOrder } from './ftx/api.js'
import { subscribeToFills, subscribeToTicker } from './ftx/ws.js'
import { SOL, Token, USDC } from './config.js'

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
			console.log('Position successfully hedged')
			clearInterval(intervalId)
			return
		}
		if (toExecuteRaw > 0) {
			console.log('Opening hedge position of size:', toExecuteRaw)
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
// TODO: USE FTX MARKET DECIMALS
const castQuoteSizeToBaseSize = (quoteSize: number, basePrice: number) =>
	floor(quoteSize / basePrice, 3)

type HedgedPositionParams = {
	ftxSymbol: string
	outputToken: Token
	quoteSize: number
}

export const openHedgedPosition = async ({
	ftxSymbol,
	outputToken,
	quoteSize,
}: HedgedPositionParams) => {
	console.log('Subscribing to websocket feeds')
	const addToHedge = useHedge(USDC, outputToken, quoteSize)
	let orderId: null | number = null

	let ask = 0
	const tickerUnsub = subscribeToTicker(ftxSymbol, async (_ask) => {
		ask = _ask
	})

	let remainingSize = quoteSize
	const fillsUnsub = subscribeToFills(({ size, orderId: fillOrderId, price }) => {
		if (orderId === fillOrderId) {
			const quoteSize = castBaseSizeToQuoteSize(size, price, USDC.decimals)
			remainingSize -= quoteSize
			addToHedge(quoteSize)
		}
	})

	await setTimeout(5000)
	console.log('Placing first order at:', ask)
	const { data: firstOrder } = await placeOrder({
		symbol: ftxSymbol,
		price: ask,
		size: castQuoteSizeToBaseSize(quoteSize, ask),
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
				size: castQuoteSizeToBaseSize(remainingSize, ask),
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

	console.log('Successfully opened hedged position')
}
