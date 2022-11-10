export const logMsgPrefix = {
	jupiter: '[JUPITER]:',
	main: '[MAIN]:',
	position: '[POSITION]:',
	ftx: '[FTX]:',
} as const

type LogType = 'throw' | 'log' | 'error' | 'info'

export const logMessage = ({ module, type = 'log' }: { module: keyof typeof logMsgPrefix, type?: LogType }, ...msg: string[]) => {
	switch (type) {
		case 'throw': {
			throw Error(`${logMsgPrefix[module]} ${msg.join(' ')}`)
		}
		default: {
			console[type](logMsgPrefix[module], ...msg)
		}
	}
}
