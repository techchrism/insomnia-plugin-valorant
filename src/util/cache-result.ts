/**
 * Caches the result of a function for a given amount of time
 * @param cacheTimeMS the amount of time to cache the result for in milliseconds
 * @param func the function to cache the result of
 */
export function cacheResult<T, U extends unknown[]>(cacheTimeMS: number, func: (...args: U) => T): (...args: U) => T {
    let cache: {result: T, expires: number} | undefined = undefined

    return (...args: U) => {
        if(cache !== undefined && cache.expires > Date.now()) return cache.result
        cache = {
            result: func(...args),
            expires: Date.now() + cacheTimeMS
        }
        return cache.result
    }
}