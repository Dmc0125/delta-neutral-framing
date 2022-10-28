import { Connection, Keypair, PublicKey } from '@solana/web3.js'

import { RPC_ENDPOINT, SOL_PRIVATE_KEY } from './env.js'

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')

const pk = new Uint8Array(SOL_PRIVATE_KEY.split(',').map((x) => Number(x)))
export const solWallet = Keypair.fromSecretKey(pk)

export type Token = {
	mint: PublicKey
	decimals: number
}

export const USDC: Token = {
	mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
	decimals: 6,
}

export const SOL: Token = {
	mint: new PublicKey('So11111111111111111111111111111111111111112'),
	decimals: 9,
}
