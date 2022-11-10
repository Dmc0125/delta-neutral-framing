import { Jupiter } from '@jup-ag/core'
import { ConfirmedTransactionMeta, PublicKey, Transaction } from '@solana/web3.js'
import JSBI from 'jsbi'
import { setTimeout } from 'node:timers/promises'

import { connection, solWallet } from '../config.js'
import { logMessage } from '../utils/logger.js'
import { sendAndConfirmTransaction, TransactionResponse } from '../utils/solTransaction.js'

const jupiter = await Jupiter.load({
	cluster: 'mainnet-beta',
	user: solWallet,
	connection,
})

type ExecuteMarketBuyParams = {
	inputMint: PublicKey
	outputMint: PublicKey
	sizeRaw: number
}

export const executeMarketBuy = async ({
	inputMint,
	outputMint,
	sizeRaw,
}: ExecuteMarketBuyParams): Promise<null | ConfirmedTransactionMeta> => {
	try {
		const { routesInfos } = await jupiter.computeRoutes({
			amount: JSBI.BigInt(sizeRaw),
			slippageBps: 5,
			inputMint,
			outputMint,
		})
		if (!routesInfos.length) {
			return null
		}
		const { transactions } = await jupiter.exchange({ routeInfo: routesInfos[0] })
		Object.values(transactions).forEach((tx) => {
			if (tx) {
				tx.sign(solWallet)
			}
		})

		const executeTx = async (tx: Transaction) => {
			while (true) {
				const res = await sendAndConfirmTransaction(tx)
				if (res.success) {
					return res.data
				}
				if (res.err === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
					return () => executeMarketBuy({ inputMint, outputMint, sizeRaw })
				}
				await setTimeout(500)
			}
		}

		const {
			setupTransaction: setupTx,
			swapTransaction: swapTx,
			cleanupTransaction: cleanupTx,
		} = transactions

		if (setupTx) {
			logMessage({ module: 'jupiter', type: 'error' }, 'Executing setupTx')
			const setupRes = await executeTx(setupTx)
			if (typeof setupRes === 'function') {
				logMessage({ module: 'jupiter' }, 'SetupTx failed')
				return setupRes()
			}
		}

		logMessage({ module: 'jupiter' }, 'Executing swapTx')
		const swapRes = await executeTx(swapTx)

		if (cleanupTx) {
			logMessage({ module: 'jupiter' }, 'Executing cleanupTx')
			const cleanupRes = await executeTx(cleanupTx)
			if (typeof cleanupRes === 'function') {
				logMessage({ module: 'jupiter' }, 'CleanupTx failed')
				return cleanupRes()
			}
		}

		if (typeof swapRes === 'function') {
			logMessage({ module: 'jupiter' }, 'SwapTx failed')
			return swapRes()
		}

		return swapRes
	} catch (error) {
		logMessage({ module: 'jupiter', type: 'error' }, error as string)
		return null
	}
}
