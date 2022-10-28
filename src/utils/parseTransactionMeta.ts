import { TokenBalance, ConfirmedTransactionMeta, PublicKey } from '@solana/web3.js'

import { SOL, solWallet } from '../config.js'

export const findTokenAmountInfo = (tokenAmountInfos: TokenBalance[], tokenMint: PublicKey) =>
	tokenAmountInfos.find(
		({ owner, mint }) =>
			owner === solWallet.publicKey.toString() && mint === tokenMint.toString(),
	)

const getTokenSwapAmount = (
	preTokenBalances: TokenBalance[] | null | undefined,
	postTokenBalances: TokenBalance[] | null | undefined,
	mint: PublicKey,
) => {
	if (!preTokenBalances || !postTokenBalances) {
		return 0
	}
	const preToken = findTokenAmountInfo(preTokenBalances, mint)
	const postToken = findTokenAmountInfo(postTokenBalances, mint)
	if (!preToken || !postToken) {
		return 0
	}
	return Math.abs(Number(preToken.uiTokenAmount.amount) - Number(postToken.uiTokenAmount.amount))
}

type ParseTxMetaParams = {
  inputMint: PublicKey
  outputMint: PublicKey
}

const TX_FEE = 5000

export const parseTransactionMeta = (
  meta: ConfirmedTransactionMeta,
  { inputMint, outputMint }: ParseTxMetaParams,
) => {
	const { preTokenBalances, postTokenBalances, preBalances, postBalances } = meta

	if (inputMint.toString() === SOL.mint.toString() || outputMint.toString() === SOL.mint.toString()) {
		const solSwapAmountRaw = Math.abs(preBalances[0] - postBalances[0]) - TX_FEE
		if (inputMint.toString() === SOL.mint.toString()) {
			return {
				input: solSwapAmountRaw,
				output: getTokenSwapAmount(preTokenBalances, postTokenBalances, outputMint),
			}
		} else {
			return {
				input: getTokenSwapAmount(preTokenBalances, postTokenBalances, inputMint),
				output: solSwapAmountRaw,
			}
		}
	}

	return {
		input: getTokenSwapAmount(preTokenBalances, postTokenBalances, inputMint),
		output: getTokenSwapAmount(preTokenBalances, postTokenBalances, outputMint),
	}
}
