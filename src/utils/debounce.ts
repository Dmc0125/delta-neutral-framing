export const debounce = <T extends unknown[]>(
	fn: (...args: T) => void | Promise<void>,
	debounceTime = 500,
) => {
	let timeoutId: NodeJS.Timeout | null = null

	return (...args: T) => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
		timeoutId = setTimeout(() => {
			fn(...args)
			timeoutId = null
		}, debounceTime)
	}
}
