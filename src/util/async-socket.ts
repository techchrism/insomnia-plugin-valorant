import {connect, TLSSocket} from 'node:tls'
import {EventEmitter} from 'node:events'

// Could use better types but this is just hacky code anyway
function handleFirstOfMany(emitter: EventEmitter, eventNames: string[], callback: (name: string, data?: any[]) => void) {
    const eventHandlers = eventNames.map(name => {
        const handler = (...data: any[]) => {
            for(const otherHandler of eventHandlers) {
                if(otherHandler.name === name) continue
                emitter.removeListener(otherHandler.name, otherHandler.handler)
            }
            callback(name, data)
        }
        emitter.once(name, handler)

        return {name, handler}
    })
}

export async function waitForConnect(socket: TLSSocket) {
    if(!socket.connecting) return

    return new Promise<void>((resolve, reject) => {
        handleFirstOfMany(socket, ['connect', 'error'], (name, data) => {
            if(name === 'connect') {
                resolve()
            } else if(name === 'error') {
                reject(data![0])
            }
        })
    })
}

export async function asyncSocketWrite(socket: TLSSocket, data: string) {
    return new Promise<void>((resolve, reject) => {
        socket.write(data, err => {
            if(err) reject(err)
            else resolve()
        })
    })
}

export async function asyncSocketRead(socket: TLSSocket, abortSignal?: AbortSignal): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const onData = (data: Buffer) => {
            abortSignal?.removeEventListener('abort', onAbort)
            resolve(data)
        }
        const onAbort = () => {
            socket.removeListener('data', onData)
            reject(new Error('Aborted'))
        }

        abortSignal?.addEventListener('abort', onAbort)
        socket.once('data', onData)
    })
}
