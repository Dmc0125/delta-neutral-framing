import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const errorMessages = (prop: string, type: string) => ({
	required_error: `${prop} is required`,
	invalid_type_error: `${prop} should be typeof ${type}`,
})

const envSchema = z.object({
	RPC_ENDPOINT: z.string(errorMessages('RPC_ENDPOINT', 'string (url)')).min(1),
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

export const { RPC_ENDPOINT } = result.data
