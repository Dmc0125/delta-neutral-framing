import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const errorMessages = (prop: string, type: string) => ({
	required_error: `${prop} is required`,
	invalid_type_error: `${prop} should be typeof ${type}`,
})

const envSchema = z.object({
	RPC_ENDPOINT: z.string(errorMessages('RPC_ENDPOINT', 'string (url)')).min(1),
	FTX_API_KEY: z.string(errorMessages('FTX_API_KEY', 'string')).min(1),
	FTX_API_SECRET: z.string(errorMessages('FTX_API_SECRET', 'string')).min(1),
	FTX_SUBACCOUNT: z.string(errorMessages('FTX_SUBACCOUNT', 'string')).or(z.undefined()),
	SOL_PRIVATE_KEY: z.string(errorMessages('SOL_PRIVATE_KEY', 'string')).min(1),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
	console.error(
		`[ENV_ERROR]: Missing ENV variables. Message: ${result.error.errors
			.map(({ message }) => message)
			.join('. ')}`,
	)
	process.exit(0)
}

export const { RPC_ENDPOINT, FTX_API_KEY, FTX_API_SECRET, FTX_SUBACCOUNT, SOL_PRIVATE_KEY } =
	result.data
