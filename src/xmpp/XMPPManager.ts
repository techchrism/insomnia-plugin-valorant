import {AddressInfo, WebSocketServer, WebSocket} from 'ws'
import {getRiotClientConfig, RiotConfigResponse} from '../util/api/get-riot-client-config'
import tls from 'node:tls'
import {asyncSocketRead, asyncSocketWrite, waitForConnect} from '../util/async-socket'
import {XMLBuilder, XMLParser, XMLValidator} from 'fast-xml-parser'

const recognizedModes = ['raw', 'json', 'raw-buffered'] as const
type RecognizedMode = typeof recognizedModes[number]

const parser = new XMLParser({ignoreAttributes: false})
const builder = new XMLBuilder({ignoreAttributes: false})
let configCache: RiotConfigResponse | undefined = undefined

// I don't expect the config data I'm using to change with different token/entitlement combos which is why I'm caching it across XMPP connections
async function getOrLoadRiotConfig(token: string, entitlement: string): Promise<RiotConfigResponse> {
    if(configCache !== undefined) return configCache
    configCache = await getRiotClientConfig(token, entitlement)
    return configCache
}

function wsLog(ws: WebSocket, message: string) {
    ws.send(`[insomnia-plugin-valorant] ${message}`)
}

export class XMPPManager {
    private _wss: WebSocketServer | undefined = undefined

    private _getWebsocketURL() {
        if(this._wss === undefined) throw new Error('Websocket server not initialized!')
        const address = this._wss.address() as AddressInfo
        return `ws://${address.address}:${address.port}`
    }

    async getWebsocketURL() {
        if(this._wss !== undefined) return this._getWebsocketURL()

        return new Promise<string>((resolve, reject) => {
            this._wss = new WebSocketServer({host: '127.0.0.1', port: 0})
            this._wss.once('listening', () => {
                resolve(this._getWebsocketURL())
            })

            this._wss.on('connection', async (ws, request) => {
                try {
                    const authorization = request.headers['authorization']
                    const entitlement = request.headers['x-riot-entitlements-jwt']
                    const pasToken = request.headers['x-riot-pas-jwt']

                    if(authorization === undefined || Array.isArray(authorization) || !authorization.startsWith('Bearer ')) throw new Error('Invalid authorization header')
                    if(entitlement === undefined || Array.isArray(entitlement)) throw new Error('Invalid "x-riot-entitlements-jwt" header')
                    if(pasToken === undefined || Array.isArray(pasToken)) throw new Error('Invalid "x-riot-pas-jwt" header')

                    const token = authorization.slice('Bearer '.length)
                    const wsUrlSuffix = request.url!.split('/').pop()!
                    const mode = recognizedModes.includes(wsUrlSuffix as RecognizedMode) ? wsUrlSuffix as RecognizedMode : 'raw'

                    // Get affinity from PAS token
                    const pasParts = pasToken.split('.')
                    if(pasParts.length !== 3) throw new Error('Invalid PAS token')
                    const pasData = JSON.parse(Buffer.from(pasParts[1], 'base64').toString('utf-8'))
                    const affinity = pasData['affinity']
                    if(affinity === undefined) throw new Error('Invalid PAS token, missing affinity')

                    wsLog(ws, `Setting up XMPP connection using mode "${mode}"...`)

                    // Get affinity host and domain from riot config
                    const riotConfig = await getOrLoadRiotConfig(token, entitlement)
                    if(!riotConfig['chat.affinities'].hasOwnProperty(affinity)) throw new Error('PAS token affinity not found in riot config affinities')
                    if(!riotConfig['chat.affinity_domains'].hasOwnProperty(affinity)) throw new Error('PAS token affinity not found in riot config affinity_domains')
                    const affinityHost = riotConfig['chat.affinities'][affinity]
                    const affinityDomain = riotConfig['chat.affinity_domains'][affinity]

                    wsLog(ws, `Connecting to XMPP server "${affinityHost}:5223"...`)

                    // Open the XMPP connection
                    const socket = tls.connect({
                        host: affinityHost,
                        port: 5223
                    })
                    socket.on('close', () => ws.close())
                    await waitForConnect(socket)
                    wsLog(ws, 'Connected to XMPP server, authenticating...')

                    // Stage 1
                    await asyncSocketWrite(socket, `<?xml version="1.0"?><stream:stream to="${affinityDomain}.pvp.net" version="1.0" xmlns:stream="http://etherx.jabber.org/streams">`)
                    let incomingData = ''
                    do {
                        incomingData = (await asyncSocketRead(socket)).toString()
                    } while(!incomingData.includes('X-Riot-RSO-PAS'))

                    // Stage 2
                    await asyncSocketWrite(socket, `<auth mechanism="X-Riot-RSO-PAS" xmlns="urn:ietf:params:xml:ns:xmpp-sasl"><rso_token>${token}</rso_token><pas_token>${pasToken}</pas_token></auth>`)
                    await asyncSocketRead(socket)

                    // Stage 3
                    await asyncSocketWrite(socket, `<?xml version="1.0"?><stream:stream to="${affinityDomain}.pvp.net" version="1.0" xmlns:stream="http://etherx.jabber.org/streams">`)
                    do {
                        incomingData = (await asyncSocketRead(socket)).toString()
                    } while(!incomingData.includes('stream:features'))

                    // Stage 4
                    await asyncSocketWrite(socket, '<iq id="_xmpp_bind1" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"></bind></iq>')
                    await asyncSocketRead(socket)

                    // Stage 5
                    await asyncSocketWrite(socket, '<iq id="_xmpp_session1" type="set"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>')
                    await asyncSocketRead(socket)

                    // Stage 6
                    await asyncSocketWrite(socket, `<iq id="xmpp_entitlements_0" type="set"><entitlements xmlns="urn:riotgames:entitlements"><token xmlns="">${entitlement}</token></entitlements></iq>`)
                    await asyncSocketRead(socket)

                    wsLog(ws, 'Connected and authenticated, now proxying data!')
                    // Send an empty gap to make the log look nicer
                    ws.send('')

                    // Ping to keep the connection alive
                    const pingInterval = setInterval(() => {
                        socket.write(' ')
                    }, 150_000)
                    socket.on('close', () => clearInterval(pingInterval))

                    // Sending modes
                    if(mode === 'raw' || mode === 'raw-buffered') {
                        ws.on('message', data => {
                            if(Array.isArray(data)) {
                                data.forEach(b => socket.write(b))
                            } else if(data instanceof ArrayBuffer) {
                                socket.write(Buffer.from(data))
                            } else {
                                socket.write(data)
                            }
                        })
                    } else if(mode === 'json') {
                        ws.on('message', data => {
                            try {
                                const parsed = JSON.parse(data.toString())
                                const xml = builder.build(parsed)
                                socket.write(xml)
                            } catch(e: any) {
                                wsLog(ws, 'Invalid JSON: ' + e.toString())
                            }
                        })
                    }

                    // Receiving modes
                    if(mode === 'raw') socket.on('data', data => ws.send(data.toString()))
                    else if(mode === 'raw-buffered' || mode === 'json') {
                        let buffer = ''
                        socket.on('data', (data: Buffer) => {
                            buffer += data.toString()
                            if(XMLValidator.validate(`<a>${buffer}</a>`) === true) {
                                if(mode === 'json') {
                                    const parsed = parser.parse(buffer)
                                    ws.send(JSON.stringify(parsed))
                                } else {
                                    ws.send(buffer)
                                }
                                buffer = ''
                            }
                        })
                    }

                    ws.on('close', () => socket.destroy())
                } catch(e: any) {
                    wsLog(ws, 'Error: ' + e.toString())
                    ws.close(4000)
                }
            })
        })
    }
}