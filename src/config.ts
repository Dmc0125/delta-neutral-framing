import { Connection } from '@solana/web3.js'

import { RPC_ENDPOINT } from './env.js'

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')
