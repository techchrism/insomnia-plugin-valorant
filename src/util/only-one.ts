/**
 * Takes a function that returns a promise and ensures that only one instance of the function is running at a time.
 * @param func the function to wrap
 */
export function onlyOne<T, U extends unknown[]>(func: (...args: U) => Promise<T>): (...args: U) => Promise<T> {
    let currentPromise: Promise<T> | undefined = undefined

    return async (...args: U) => {
        if(currentPromise !== undefined) return currentPromise

        currentPromise = func(...args)
        currentPromise.finally(() => currentPromise = undefined)
        return currentPromise
    }
}