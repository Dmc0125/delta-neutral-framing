import { Connection, Keypair } from '@solana/web3.js'

import { RPC_ENDPOINT, SOL_PRIVATE_KEY } from './env.js'

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')

const pk = new Uint8Array(SOL_PRIVATE_KEY.split(',').map((x) => Number(x)))
export const solWallet = Keypair.fromSecretKey(pk)
