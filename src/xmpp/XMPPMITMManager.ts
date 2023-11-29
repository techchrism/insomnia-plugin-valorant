import {AddressInfo, WebSocketServer, WebSocket} from 'ws'
import tls from 'node:tls'
import {XMLBuilder, XMLParser, XMLValidator} from 'fast-xml-parser'
import http from 'node:http'
import {getRiotClientPath, isRiotClientRunning} from '../util/riot-client-utils'
import {exec} from 'node:child_process'

const recognizedModes = ['raw', 'json', 'raw-buffered'] as const
type RecognizedMode = typeof recognizedModes[number]

interface PlayerConfigAffinities {
    'chat.affinities': {
        [key: string]: string
    }
    'chat.host': string
    'chat.port': number
    'chat.allow_bad_cert.enabled': boolean
}

const parser = new XMLParser({ignoreAttributes: false})
const builder = new XMLBuilder({ignoreAttributes: false})

function wsLog(ws: WebSocket, message: string) {
    ws.send(`[insomnia-plugin-valorant] ${message}`)
}

function createDataBufferFunc(): (data: Buffer) => {raw: Buffer, buffered?: string, json?: any} {
    let buffer = ''
    return (data: Buffer) => {
        const dataStr = data.toString()
        // Manual workaround for invalid starting XML
        if(dataStr.includes('<stream:stream')) return {raw: data}

        buffer += dataStr
        if(XMLValidator.validate(`<a>${buffer}</a>`) === true) {
            const ret = {
                raw: data,
                buffered: buffer,
                json: parser.parse(buffer)
            }
            buffer = ''
            return ret
        } else {
            return {raw: data}
        }
    }
}

const xmppServerCert = `-----BEGIN CERTIFICATE-----
MIIDbTCCAlWgAwIBAgIUXs/1zAQpmxe0y6ec/8jvBfQZBiswDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAgFw0yMzAxMjQwNzM0MzNaGA8zMDAz
MDMyODA3MzQzM1owRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUx
ITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAKyT+K0jjzHslcbus+fc7mTj/RfCxDA5Wj8dOzJD
8Nrta8jtOT+qGGj1n5gJ0aPZQYm4x0CEo3jrjD0+U1TB1BaEsTgsSzpAbFY8rbJ5
rZ0+MvEwvmLf50HVukUs8FEnAaeP6/YSSlGN4vCEUIPyOfAYYeTiwrXbyzH9xjg5
jx81OTLaxVsvOf6S63y2ftfL4GZnDzfvJSD5PAJOfpYnH5cF9vg3yzp+MSP3Ro5H
mf7K6rjXoZLTrop2M9XNZohsRFDRuT1gBhkb/EeCdB8iDzjX2LVQOOXMk/NnhrJA
2zkb4ok7IuhsyaiwP7s3BndyqPjPBVZFJ6/Kxo/w7o4zZXcCAwEAAaNTMFEwHQYD
VR0OBBYEFJSeSArWBXRxDhvckeJEi7LSn7BAMB8GA1UdIwQYMBaAFJSeSArWBXRx
DhvckeJEi7LSn7BAMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEB
AIqdrifxD19Bn4MGHNN+XPnpyUOteU45A3STJc+Lxff62H1rs8BkiqrxkWiwL/o8
kJtRzvr1EUmOE4KLNDF5GdQmQHINneyMGfozdcs1JTK8St5qzh0GZgTyQCScRxb/
8Zaf7kH655YyLhULu0voQT8uMTT3sSVpdQbYPvNmcoh2aT+0ZMirEnXqLBYteVmW
r3JATNJ9lWRfzIQyzjm0YhDS38JOaZv8lZvIbpS4qYorRjvKR7IK6hcvHcWQ4pYE
ATMxsr58oO7JJ1HRJ3rqRivaGlIm5zJLO20YYbzDlzDqYnbbwg/VjBwoe37XW6P6
ZqjVFV3OnufZ9oIFcO0YdBI=
-----END CERTIFICATE-----`

const xmppServerKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsk/itI48x7JXG
7rPn3O5k4/0XwsQwOVo/HTsyQ/Da7WvI7Tk/qhho9Z+YCdGj2UGJuMdAhKN464w9
PlNUwdQWhLE4LEs6QGxWPK2yea2dPjLxML5i3+dB1bpFLPBRJwGnj+v2EkpRjeLw
hFCD8jnwGGHk4sK128sx/cY4OY8fNTky2sVbLzn+kut8tn7Xy+BmZw837yUg+TwC
Tn6WJx+XBfb4N8s6fjEj90aOR5n+yuq416GS066KdjPVzWaIbERQ0bk9YAYZG/xH
gnQfIg8419i1UDjlzJPzZ4ayQNs5G+KJOyLobMmosD+7NwZ3cqj4zwVWRSevysaP
8O6OM2V3AgMBAAECggEATQG0H7Hz1g+fH8bo0Sf02mEfUMhwWaJl4i7NeNb3NQFn
LJ+qAX4JaWBcx+9ts8Kga29fvarR9QWKLNPQREw/MpMgLxQYt1QC45Is4axI65bT
DWu2MJF/dBGGDhMI4vVYWCgw3rr3nZ+F6dPox4/BCaEfoY4L2zFJ4LNADVulwQL1
0/TSYruFO7mKJczUwc1POgzDY36VXZ95GhquiMjSc5o+/+DnlkPMLAJL99rScn69
sqx16VTIN516TqDarEQpwzIrRNIirwsGrTvKl8YLR+jnHeAP/1pZ8mqpWmRlArDp
k/ihZsqOdgxuer5eZi3rL+ttKfsJLBuyeDJ1Kb8YIQKBgQDyfRWANb/afwlNOenS
uz8sjwLCdtRsTtZKvo9dnBNEA9jvwfQIrtk83Zs2H92Ytd55sSMyywKOJOAxTJh/
iSC3zn5qDXJqHW+sK3mnt4VlMuqjE84Dra2AWB71TEgTDsVJjeBDwwjKJdLiRJP1
g6QgrbMd/hUvv+QEToUXOs9VFwKBgQC2Mapx0V21JV9dBcVGTOXYVp+rqNEBS0kg
Mu+vvjxlU08KkE4+RjHh4Tyz8FA4uv307bin5Nx67HZ5WG6O9xOTM+uLCfnF56M2
DPtkoh5htMHUEq4JS94XqEllsW8ny1J3ueK/z77UB1vSapsXCliC0tFzEbcbuhdZ
AHQWtBluoQKBgBmTF7Ft+c4Rl+mNMhwHo6IPczsPTVge+HrpnjVBQMbroPWofxRr
XH4O4U/UDIsOo2gyRoQU5TAYs4x/h5Xr4IeCP9LvmCGY+S4vZ6VItcj2lcidTh0V
NDdVE+7LHM7lv+kCDaUX7NVlJ9i1YuWB/M11hG6lXZarpmDN5zuL+FIBAoGAMMrG
Oar3LH7wtgnIlhYb677vDdqs9mrCD6R0eh05MW2JGmwg+B52V2apigrOgRLa1hAf
xp7MyQKwi7i6CwFyNZbO+rJWOMDa/aumW4HrHwF4cyH5h7XQqYdA+MH24bJayIN4
jSPGmCPMXGJ+XEJCB+8LdoSFBCDnBcfQTxA2S2ECgYEA3N+OWLSLLbbUtSJetvXj
WFPwHm/bQGdYHmq3e9egShxVEEy7aocN7+VRON4ss25AhYUSJlt+lj3aVtUhOZWg
5Pvx75kNmZRBkQRhBCu/3KbwBeNiGYyLKvkIRRSCIb+xWeyWk/1JbNR9oBvAf3wB
sido67spMMdn70Lk6PqkJTw=
-----END PRIVATE KEY-----`

export class XMPPMITMManager {
    private _server: http.Server | undefined = undefined
    private _xmppServer: tls.Server | undefined = undefined
    private _wss: WebSocketServer | undefined = undefined

    private _clients: {ws: WebSocket, mode: RecognizedMode}[] = []
    private _sockets: {server: tls.TLSSocket, client: tls.TLSSocket}[] = []

    private _getWebsocketURL() {
        if(this._server === undefined) throw new Error('Server not initialized!')
        const address = this._server.address() as AddressInfo
        return `ws://${address.address}:${address.port}`
    }

    async getWebsocketURL() {
        if(this._server !== undefined) return this._getWebsocketURL()

        return new Promise<string>((resolve, reject) => {
            const affinityMappings: {
                localHost: string,
                riotHost: string,
                riotPort: number
            }[] = []
            let affinityMappingID = 0

            // Set up http server for config proxying and websocket to Insomnia
            this._server = http.createServer(async (req, res) => {
                console.log(`Request: ${req.method} ${req.url}`)
                const proxiedHeaders = new Headers(req.headers as HeadersInit)
                proxiedHeaders.delete('host')

                const response = await fetch(`https://clientconfig.rpg.riotgames.com${req.url}`, {
                    method: req.method,
                    headers: proxiedHeaders
                })
                const text = await response.text()

                res.writeHead(response.status)

                res.writeHead(response.status)
                if(req.url?.startsWith('/api/v1/config/player') && response.status === 200) {
                    // Rewrite affinity data
                    const data = JSON.parse(text) satisfies PlayerConfigAffinities
                    if(data.hasOwnProperty('chat.affinities')) {
                        for(const [region, ip] of Object.entries(data['chat.affinities'])) {
                            const existingMapping = affinityMappings.find(mapping => mapping.riotHost === ip)
                            if(existingMapping !== undefined) {
                                data['chat.affinities'][region] = existingMapping.localHost
                            } else {
                                const newMapping = {
                                    localHost: `127.0.0.${++affinityMappingID}`,
                                    riotHost: ip as string,
                                    riotPort: data['chat.port']
                                }
                                affinityMappings.push(newMapping)
                                data['chat.affinities'][region] = newMapping.localHost
                            }
                        }
                        const address = this._xmppServer!.address() as AddressInfo
                        data['chat.port'] = address.port
                        data['chat.host'] = address.address
                        data['chat.allow_bad_cert.enabled'] = true
                    }
                    res.write(JSON.stringify(data))
                } else {
                    res.write(text)
                }
                res.end()
            })
            this._server.listen(0, '127.0.0.1')
            this._server.once('listening', () => {
                resolve(this._getWebsocketURL())
            })

            // Set up XMPP server
            this._xmppServer = tls.createServer({
                key: xmppServerKey,
                cert: xmppServerCert,
                rejectUnauthorized: false,
                requestCert: false
            }, socket => {
                const ipv4LocalHost = socket.localAddress?.replace('::ffff:', '')
                const mapping = affinityMappings.find(mapping => mapping.localHost === ipv4LocalHost)
                if(mapping === undefined) {
                    this._clients.forEach(c => wsLog(c.ws, `Unknown host ${socket.localAddress}`))
                    socket.destroy()
                    return
                }

                this._clients.forEach(c => wsLog(c.ws, `Connecting to ${mapping.riotHost}:${mapping.riotPort}...`))

                let preConnectBuffer = Buffer.alloc(0)

                const riotTLS = tls.connect({
                    host: mapping.riotHost,
                    port: mapping.riotPort,
                    rejectUnauthorized: false,
                    requestCert: false
                }, () => {
                    if(preConnectBuffer.length > 0) {
                        riotTLS.write(preConnectBuffer)
                        preConnectBuffer = Buffer.alloc(0)
                    }
                })
                this._sockets.push({server: riotTLS, client: socket})
                socket.on('close', () => {
                    this._sockets = this._sockets.filter(s => s.client !== socket)
                })

                let serverBufferFunc = createDataBufferFunc()
                let clientBufferFunc = createDataBufferFunc()

                riotTLS.on('data', data => {
                    socket.write(data)
                    const {raw, buffered, json} = serverBufferFunc(data)
                    for(const client of this._clients) {
                        if(client.mode === 'raw') client.ws.send('🟧 from server\n' + raw.toString())
                        else if(client.mode === 'raw-buffered' && buffered !== undefined) client.ws.send('🟧 from server\n' + buffered)
                        else if(client.mode === 'json' && json !== undefined) client.ws.send(JSON.stringify(['🟧 from server', json]))
                    }
                })

                riotTLS.on('close', () => {
                    socket.destroy()
                    this._clients.forEach(c => {
                        wsLog(c.ws, `Riot server XMPP closed`)
                        c.ws.close()
                    })
                })

                socket.on('data', data => {
                    if(riotTLS.connecting) {
                        preConnectBuffer = Buffer.concat([preConnectBuffer, data])
                    } else {
                        riotTLS.write(data)
                        const {raw, buffered, json} = clientBufferFunc(data)
                        for(const client of this._clients) {
                            if(client.mode === 'raw') client.ws.send('🟦 from client\n' + raw.toString())
                            else if(client.mode === 'raw-buffered' && buffered !== undefined) client.ws.send('🟦 from client\n' + buffered)
                            else if(client.mode === 'json' && json !== undefined) client.ws.send(JSON.stringify(['🟦 from client', json]))
                        }
                    }
                })

                socket.on('close', () => {
                    this._clients.forEach(c => {
                        wsLog(c.ws, `Riot client disconnected from ${mapping.riotHost}:${mapping.riotPort}`)
                        c.ws.close()
                    })
                    riotTLS.destroy()
                })
            }).listen(0)


            this._wss = new WebSocketServer({server: this._server})

            this._wss.on('connection', async (ws, request) => {
                try {
                    const wsUrlSuffix = request.url!.split('/').pop()!
                    const mode = recognizedModes.includes(wsUrlSuffix as RecognizedMode) ? wsUrlSuffix as RecognizedMode : 'raw'
                    this._clients.push({ws, mode})
                    ws.on('close', () => {
                        this._clients = this._clients.filter(client => client.ws !== ws)
                    })

                    if(await isRiotClientRunning()) throw new Error('Riot Client is running, please close it before running the MITM')

                    wsLog(ws, 'Starting Riot Client...')
                    const riotClientPath = await getRiotClientPath()
                    const address = this._server!.address() as AddressInfo
                    const riotChildProcess = exec(`"${riotClientPath}" --client-config-url="http://${address.address}:${address.port}" --launch-product=valorant --launch-patchline=live`)

                    // Sending modes
                    const helpMessage = 'Message must start with "to-server" or "to-client" followed by a newline, followed by the message'
                    const handleIndividualMessage = (buffer: Buffer) => {
                        const text = buffer.toString()
                        const lines = text.split('\n')
                        if(lines.length === 1) {
                            wsLog(ws, '❌ Invalid message, only found one line. ' + helpMessage)
                            return
                        }
                        const direction = lines.shift()!
                        const dataStr = (mode === 'json') ? builder.build(JSON.parse(lines.join('\n'))) : lines.join('\n')
                        if(direction === 'to-server') {
                            this._sockets.forEach(s => s.server.write(dataStr))
                        } else if(direction === 'to-client') {
                            this._sockets.forEach(s => s.client.write(dataStr))
                        } else {
                            wsLog(ws, '❌ Invalid direction. ' + helpMessage)
                            return
                        }
                    }

                    ws.on('message', data => {
                        if(Array.isArray(data)) {
                            data.forEach(b => handleIndividualMessage(b))
                        } else if(data instanceof ArrayBuffer) {
                            handleIndividualMessage(Buffer.from(data))
                        } else {
                            handleIndividualMessage(data)
                        }
                    })
                } catch(e: any) {
                    wsLog(ws, 'Error: ' + e.toString())
                    ws.close(4000)
                }
            })
        })
    }
}