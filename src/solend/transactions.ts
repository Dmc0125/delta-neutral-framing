import { ConfirmedTransactionMeta, PublicKey, Transaction } from '@solana/web3.js'
import { SolendAction } from '@solendprotocol/solend-sdk'
import { setTimeout } from 'node:timers/promises'

import { connection, solWallet } from '../config.js'
import { sendAndConfirmTransaction, TransactionResponse } from '../utils/solTransaction.js'

type SolendActionParams = {
  amountRaw: number
  symbol: string
  poolAddress: PublicKey
}

const parseSolendTxs = async (solendAction: SolendAction) => {
  const {
    preLendingTxn,
    lendingTxn,
    postLendingTxn,
  } = await solendAction.getTransactions()
  return {
    setupTx: preLendingTxn,
    mainTx: lendingTxn!,
    cleanupTx: postLendingTxn,
  }
}

const signTxs = (...txs: (Transaction | null)[]) => {
  txs.forEach((tx) => {
    if (tx) {
      tx.sign(solWallet)
    }
  })
}

const executeTx = async (tx: Transaction, onBlockHeightExceeded: () => Promise<ConfirmedTransactionMeta>) => {
  let res = await sendAndConfirmTransaction(tx)
  while (!res.success) {
    if (res.err === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
      return onBlockHeightExceeded
    }
    await setTimeout(500)
    res = await sendAndConfirmTransaction(tx)
  }
  return res.data
}

const buildDepositTxs = async ({
  amountRaw,
  symbol,
  poolAddress,
}: SolendActionParams) => {
  const solendAction = await SolendAction.buildDepositTxns(
    connection,
    amountRaw.toString(),
    symbol,
    solWallet.publicKey,
    'production',
    poolAddress,
  )

  return parseSolendTxs(solendAction)
}

export const depositToSolend = async ({
  amountRaw,
  symbol,
  poolAddress,
}: SolendActionParams): Promise<ConfirmedTransactionMeta> => {
  const { setupTx, mainTx, cleanupTx } = await buildDepositTxs({
    amountRaw,
    symbol,
    poolAddress,
  })

  signTxs(setupTx, mainTx, cleanupTx)

  const onBlockHeightExceeded = () => depositToSolend({ amountRaw, symbol, poolAddress })

  if (setupTx) {
    const res = await executeTx(setupTx, onBlockHeightExceeded)
    if (typeof res === 'function') {
      return res()
    }
  }   

  const depositRes = await executeTx(mainTx, onBlockHeightExceeded)

  if (cleanupTx) {
    const cleanupRes = await executeTx(cleanupTx, onBlockHeightExceeded)
    if (typeof cleanupRes === 'function') {
      return cleanupRes()
    }
  }

  if (typeof depositRes === 'function') {
    return depositRes()
  }

  return depositRes
}

const buildWithdrawTxs = async ({
  amountRaw,
  symbol,
  poolAddress,
}: SolendActionParams) => {
  const solendAction = await SolendAction.buildWithdrawTxns(
    connection,
    amountRaw.toString(),
    symbol,
    solWallet.publicKey,
    'production',
    poolAddress,
  )
  return parseSolendTxs(solendAction)
}

export const withdrawFromSolend = async ({
  amountRaw,
  symbol,
  poolAddress,
}: SolendActionParams): Promise<ConfirmedTransactionMeta> => {
  const { setupTx, mainTx, cleanupTx } = await buildWithdrawTxs({
    amountRaw,
    symbol,
    poolAddress,
  })

  signTxs(setupTx, mainTx, cleanupTx)

  const onBlockHeightExceeded = () => withdrawFromSolend({ amountRaw, symbol, poolAddress })

  if (setupTx) {
    const setupRes = await executeTx(setupTx, onBlockHeightExceeded)
    if (typeof setupRes === 'function') {
      return setupRes()
    }
  }

  const withdrawRes = await executeTx(mainTx, onBlockHeightExceeded)

  if (cleanupTx) {
    const cleanupRes = await executeTx(cleanupTx, onBlockHeightExceeded)
    if (typeof cleanupRes === 'function') {
      return cleanupRes()
    }
  }

  if (typeof withdrawRes === 'function') {
    return withdrawRes()
  }

  return withdrawRes
}
