import {AddressInfo, WebSocketServer, WebSocket} from 'ws'
import {getRiotClientConfig, RiotConfigResponse} from './util/api/get-riot-client-config'
import tls from 'node:tls'
import {asyncSocketRead, asyncSocketWrite, waitForConnect} from './util/async-socket'

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

                    // Get affinity from PAS token
                    const pasParts = pasToken.split('.')
                    if(pasParts.length !== 3) throw new Error('Invalid PAS token')
                    const pasData = JSON.parse(Buffer.from(pasParts[1], 'base64').toString('utf-8'))
                    const affinity = pasData['affinity']
                    if(affinity === undefined) throw new Error('Invalid PAS token, missing affinity')

                    wsLog(ws, 'Setting up XMPP connection...')

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
                    let requestID = 0

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

                    socket.on('data', data => ws.send(data.toString()))
                    ws.on('message', data => {
                        if(Array.isArray(data)) {
                            data.forEach(b => socket.write(b))
                        } else if(data instanceof ArrayBuffer) {
                            socket.write(Buffer.from(data))
                        } else {
                            socket.write(data)
                        }
                    })
                    ws.on('close', () => socket.destroy())
                } catch(e: any) {
                    ws.send('[insomnia-plugin-valorant] internal error: ' + e.toString())
                    ws.close(4000)
                }
            })
        })
    }
}