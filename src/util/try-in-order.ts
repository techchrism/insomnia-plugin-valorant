//TODO add option for labeled input for better formatted errors
export async function tryInOrder<T>(functions: (() => Promise<T>)[]): Promise<T> {
    const errors = []
    for(const func of functions) {
        try {
            return await func()
        } catch (e) {
            errors.push(e)
        }
    }
    throw errors
}