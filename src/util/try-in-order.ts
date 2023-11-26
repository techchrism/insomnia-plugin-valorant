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

export async function tryInOrderLabeled<T>(functions: {label: string, func: (() => Promise<T>)}[]): Promise<T> {
    const errors: {label: string, error: any}[] = []
    for(const {label, func} of functions) {
        try {
            return await func()
        } catch (e) {
            errors.push({label, error: e})
        }
    }
    throw `Error${functions.length === 1 ? '' : 's'} when running ${functions.length} function${functions.length === 1 ? '' : 's'}:\n\n` +
        errors.map(e =>
            `Error when running "${e.label}":\n    ${e.error.toString().split('\n').join('\n    ')}`
        ).join('\n\n')
}