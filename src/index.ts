import logSleuth, {infoKeys, LogInfo} from './util/log-sleuth'
import {tryInOrder, tryInOrderLabeled} from './util/try-in-order'
import {readLockfile} from './util/read-lockfile'
import {hasWorkspaceActionsBug} from './util/has-workspace-actions-bug'
import {openWebViewPopup} from './util/auth/open-webview-popup'
import {webviewLogout} from './util/auth/webview-logout'
import {AuthRedirectData} from './util/auth/parse-auth-redirect'
import {authFromRiotClient} from './util/auth/auth-from-riot-client'
import {checkWebViewData} from './util/auth/check-webview-data'
import {getRegion} from './util/auth/get-region'
import {getEntitlement} from './util/auth/get-entitlement'
import {getPregameMatchId} from './util/api/get-pregame-match-id'
import {getCurrentGameMatchId} from './util/api/get-current-game-match-id'
import {getPartyId} from './util/api/get-party-id'
import {onlyOne} from './util/only-one'
import {cacheResult} from './util/cache-result'
import {getPASToken} from './util/auth/get-pas-token'

interface ValorantAPIVersionResponse {
    data: {
        riotClientVersion: string
    }
}

interface ValorantOverrides {
    clientPlatform?: string
    clientVersion?: string
    lockfilePort?: string
    lockfilePassword?: string
    puuid?: string
    entitlement?: string
    token?: string
    idToken?: string
    pasToken?: string
    region?: string
    shard?: string,
    pregameMatchId?: string
    currentGameMatchId?: string
    partyId?: string
}

interface TemplateTagContext {
    valorantOverrides?: ValorantOverrides
}

interface Context {
    store: {
        setItem(key: string, value: string): Promise<void>
        removeItem(key: string): Promise<void>
    }
    app: {
        alert(message: string): void
    }
}

module.exports.workspaceActions = [
    {
        label: 'Remove Saved Valorant Data',
        action: async (context: Context) => {
            // cookies and region are not used anymore, but are kept for clearing old data
            await Promise.all(['successfulLogin', 'expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)))
            context['app'].alert('Cleared Valorant data!')
        }
    },
    {
        label: 'Riot Login',
        action: async (context: Context) => {
            //TODO make popup open immediately and show a loading screen until the logout action completes
            await webviewLogout()
            try {
                const partialAuthInfo = await openWebViewPopup(context)
                cachedAuthInfo = {
                    ...partialAuthInfo,
                    entitlement: await getEntitlement(partialAuthInfo.accessToken)
                }
            } catch(ignored) {}
        }
    },
    {
        label: 'Riot Logout',
        action: async () => {
            await webviewLogout()
        }
    }
]
if(hasWorkspaceActionsBug()) {
    module.exports.requestActions = module.exports.workspaceActions
}

let cachedCompleteLogInfo: LogInfo | undefined = undefined
let cachedAuthInfo: AuthRedirectData & {entitlement: string, pasToken?: string} | undefined = undefined
let cachedRegionInfo: {region: string, shard: string} | undefined = undefined
let cachedClientVersion: string | undefined = undefined

async function getOrLoadLogInfo() {
    if(cachedCompleteLogInfo !== undefined) return cachedCompleteLogInfo

    const info = await logSleuth()
    if (!info) throw new Error('Could not find log info')
    for (const key of infoKeys) {
        if (info[key] === undefined) throw new Error(`Could not find log info for ${key}`)
    }
    cachedCompleteLogInfo = info as LogInfo

    return cachedCompleteLogInfo
}

async function getOrLoadAuthInfo() {
    if(cachedAuthInfo !== undefined && cachedAuthInfo.expiresAt > Date.now()) return cachedAuthInfo

    try {
        const partialAuthInfo = await tryInOrderLabeled([
            {
                label: 'Use auth from Riot Client',
                func: async () => await authFromRiotClient()
            },
            {
                label: 'Use auth from stored login workspace action',
                func: async () => await checkWebViewData()
            }
        ])
        cachedAuthInfo = {
            ...partialAuthInfo,
            entitlement: await getEntitlement(partialAuthInfo.accessToken)
        }
        return cachedAuthInfo
    } catch(e) {
        let message = `${e}\n\nTry logging in with the "Riot Login" workspace action`
        if(hasWorkspaceActionsBug()) {
            message += '\n\nNote - It seems like you\'re using a version of Insomnia that has a bug with workspace actions. As a workaround, you can use the dropdown actions on a request.'
        }
        throw new Error(message)
    }
}

async function getOrLoadPASToken() {
    if(cachedAuthInfo?.pasToken !== undefined && cachedAuthInfo.expiresAt > Date.now()) return cachedAuthInfo.pasToken

    const authInfo = await getOrLoadAuthInfo()
    cachedAuthInfo = {
        ...authInfo,
        pasToken: await getPASToken(authInfo.accessToken)
    }
    return cachedAuthInfo.pasToken
}

async function getOrLoadRegionInfo() {
    if(cachedRegionInfo !== undefined) return cachedRegionInfo

    if(cachedCompleteLogInfo !== undefined) {
        cachedRegionInfo = {
            region: cachedCompleteLogInfo.region,
            shard: cachedCompleteLogInfo.shard
        }
        return cachedRegionInfo
    }

    try {
        const logInfo = await getOrLoadLogInfo()
        cachedRegionInfo = {
            region: logInfo.region,
            shard: logInfo.shard
        }
        return cachedRegionInfo
    } catch(logError) {
        try {
            const authInfo = await getOrLoadAuthInfo()
            cachedRegionInfo = await getRegion(authInfo.accessToken, authInfo.idToken)
            return cachedRegionInfo
        } catch(authError) {
            throw [logError, authError]
        }
    }
}

async function getOrLoadClientVersion() {
    if(cachedClientVersion !== undefined) return cachedClientVersion
    /*
        note that the api endpoint and the logs have a different format for the version, but it seems both work
        log version: release-07.10-6-2100005
        api version: release-07.10-shipping-6-2100005
     */
    cachedClientVersion = await tryInOrder([
        async () => (await getOrLoadLogInfo()).clientVersion,
        async () => ((await (await fetch('https://valorant-api.com/v1/version')).json()) as ValorantAPIVersionResponse).data.riotClientVersion
    ])
    return cachedClientVersion
}

// Some names are preceded by "valorant_" because I expect they might conflict with tags added by other plugins
module.exports.templateTags = [
    {
        name: 'client_platform',
        displayName: 'Client Platform',
        description: 'Valorant client platform',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.clientPlatform !== undefined && ctx.valorantOverrides.clientPlatform.length !== 0) return ctx.valorantOverrides.clientPlatform
            return 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
        })
    },
    {
        name: 'client_version',
        displayName: 'Client Version',
        description: 'Valorant client version',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.clientVersion !== undefined && ctx.valorantOverrides.clientVersion.length !== 0) return ctx.valorantOverrides.clientVersion
            return await getOrLoadClientVersion()
        })
    },
    {
        name: 'lockfile_port',
        displayName: 'Lockfile Port',
        description: 'Valorant lockfile port',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.lockfilePort !== undefined && ctx.valorantOverrides.lockfilePort.length !== 0) return ctx.valorantOverrides.lockfilePort
            try {
                return (await readLockfile()).port
            } catch(e) {
                throw new Error('Lockfile not found! Is Valorant running?')
            }
        })
    },
    {
        name: 'lockfile_password',
        displayName: 'Lockfile Password',
        description: 'Valorant lockfile password',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.lockfilePassword !== undefined && ctx.valorantOverrides.lockfilePassword.length !== 0) return ctx.valorantOverrides.lockfilePassword
            try {
                return (await readLockfile()).password
            } catch(e) {
                throw new Error('Lockfile not found! Is Valorant running?')
            }
        })
    },
    {
        name: 'puuid',
        displayName: 'PUUID',
        description: 'Valorant PUUID',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.puuid !== undefined && ctx.valorantOverrides.puuid.length !== 0) return ctx.valorantOverrides.puuid

            if(cachedAuthInfo !== undefined) return cachedAuthInfo.puuid
            if(cachedCompleteLogInfo !== undefined) return cachedCompleteLogInfo.puuid

            return await tryInOrderLabeled([
                {
                    label: 'Use puuid from log file scraping',
                    func: async () => (await getOrLoadLogInfo()).puuid
                },
                {
                    label: 'Use puuid from auth info',
                    func: async () => (await getOrLoadAuthInfo()).puuid
                }
            ])
        })
    },
    {
        name: 'valorant_region',
        displayName: 'Region',
        description: 'Valorant account region',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.region !== undefined && ctx.valorantOverrides.region.length !== 0) return ctx.valorantOverrides.region
            if(cachedRegionInfo !== undefined) return cachedRegionInfo.region
            return (await getOrLoadRegionInfo()).region
        })
    },
    {
        name: 'valorant_shard',
        displayName: 'Shard',
        description: 'Valorant account shard',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.shard !== undefined && ctx.valorantOverrides.shard.length !== 0) return ctx.valorantOverrides.shard
            if(cachedRegionInfo !== undefined) return cachedRegionInfo.shard
            return (await getOrLoadRegionInfo()).shard
        })
    },
    {
        name: 'valorant_token',
        displayName: 'Token',
        description: 'Valorant auth token',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.token !== undefined && ctx.valorantOverrides.token.length !== 0) return ctx.valorantOverrides.token
            return (await getOrLoadAuthInfo()).accessToken
        })
    },
    {
        name: 'valorant_entitlement',
        displayName: 'Entitlement',
        description: 'Valorant entitlement token',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.entitlement !== undefined && ctx.valorantOverrides.entitlement.length !== 0) return ctx.valorantOverrides.entitlement
            return (await getOrLoadAuthInfo()).entitlement
        })
    },
    {
        name: 'valorant_id_token',
        displayName: 'ID Token',
        description: 'Valorant ID token',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.idToken !== undefined && ctx.valorantOverrides.idToken.length !== 0) return ctx.valorantOverrides.idToken
            return (await getOrLoadAuthInfo()).idToken
        })
    },
    {
        name: 'valorant_pas_token',
        displayName: 'PAS Token',
        description: 'Valorant PAS token',
        run: onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.pasToken !== undefined && ctx.valorantOverrides.pasToken.length !== 0) return ctx.valorantOverrides.pasToken
            return await getOrLoadPASToken()
        })
    },
    {
        name: 'pregame_match_id',
        displayName: 'Pre-Game Match ID',
        description: 'Valorant pre-game match ID',
        run: cacheResult(1_000, onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.pregameMatchId !== undefined && ctx.valorantOverrides.pregameMatchId.length !== 0) return ctx.valorantOverrides.pregameMatchId

            const token = (ctx.valorantOverrides?.token !== undefined && ctx.valorantOverrides.token.length !== 0) ? ctx.valorantOverrides.token : (await getOrLoadAuthInfo()).accessToken
            const entitlement = (ctx.valorantOverrides?.entitlement !== undefined && ctx.valorantOverrides.entitlement.length !== 0) ? ctx.valorantOverrides.entitlement : (await getOrLoadAuthInfo()).entitlement
            const region = (ctx.valorantOverrides?.region !== undefined && ctx.valorantOverrides.region.length !== 0) ? ctx.valorantOverrides.region : (await getOrLoadRegionInfo()).region
            const shard = (ctx.valorantOverrides?.shard !== undefined && ctx.valorantOverrides.shard.length !== 0) ? ctx.valorantOverrides.shard : (await getOrLoadRegionInfo()).shard
            const puuid = (ctx.valorantOverrides?.puuid !== undefined && ctx.valorantOverrides.puuid.length !== 0) ? ctx.valorantOverrides.puuid : (await getOrLoadAuthInfo()).puuid

            return await getPregameMatchId(shard, region, puuid, token, entitlement)
        }))
    },
    {
        name: 'current_game_match_id',
        displayName: 'Current Game Match ID',
        description: 'Valorant current game match ID',
        run: cacheResult(1_000, onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.currentGameMatchId !== undefined && ctx.valorantOverrides.currentGameMatchId.length !== 0) return ctx.valorantOverrides.currentGameMatchId

            const token = (ctx.valorantOverrides?.token !== undefined && ctx.valorantOverrides.token.length !== 0) ? ctx.valorantOverrides.token : (await getOrLoadAuthInfo()).accessToken
            const entitlement = (ctx.valorantOverrides?.entitlement !== undefined && ctx.valorantOverrides.entitlement.length !== 0) ? ctx.valorantOverrides.entitlement : (await getOrLoadAuthInfo()).entitlement
            const region = (ctx.valorantOverrides?.region !== undefined && ctx.valorantOverrides.region.length !== 0) ? ctx.valorantOverrides.region : (await getOrLoadRegionInfo()).region
            const shard = (ctx.valorantOverrides?.shard !== undefined && ctx.valorantOverrides.shard.length !== 0) ? ctx.valorantOverrides.shard : (await getOrLoadRegionInfo()).shard
            const puuid = (ctx.valorantOverrides?.puuid !== undefined && ctx.valorantOverrides.puuid.length !== 0) ? ctx.valorantOverrides.puuid : (await getOrLoadAuthInfo()).puuid

            return getCurrentGameMatchId(shard, region, puuid, token, entitlement)
        }))
    },
    {
        name: 'party_id',
        displayName: 'Party ID',
        description: 'Valorant party ID',
        run: cacheResult(1_000, onlyOne(async (ctx: TemplateTagContext) => {
            if(ctx.valorantOverrides?.partyId !== undefined && ctx.valorantOverrides.partyId.length !== 0) return ctx.valorantOverrides.partyId

            const token = (ctx.valorantOverrides?.token !== undefined && ctx.valorantOverrides.token.length !== 0) ? ctx.valorantOverrides.token : (await getOrLoadAuthInfo()).accessToken
            const entitlement = (ctx.valorantOverrides?.entitlement !== undefined && ctx.valorantOverrides.entitlement.length !== 0) ? ctx.valorantOverrides.entitlement : (await getOrLoadAuthInfo()).entitlement
            const region = (ctx.valorantOverrides?.region !== undefined && ctx.valorantOverrides.region.length !== 0) ? ctx.valorantOverrides.region : (await getOrLoadRegionInfo()).region
            const shard = (ctx.valorantOverrides?.shard !== undefined && ctx.valorantOverrides.shard.length !== 0) ? ctx.valorantOverrides.shard : (await getOrLoadRegionInfo()).shard
            const puuid = (ctx.valorantOverrides?.puuid !== undefined && ctx.valorantOverrides.puuid.length !== 0) ? ctx.valorantOverrides.puuid : (await getOrLoadAuthInfo()).puuid
            const clientVersion = (ctx.valorantOverrides?.clientVersion !== undefined && ctx.valorantOverrides.clientVersion.length !== 0) ? ctx.valorantOverrides.clientVersion : await getOrLoadClientVersion()

            return await getPartyId(shard, region, puuid, clientVersion, token, entitlement)
        }))
    }
]