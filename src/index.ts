import logSleuth, {infoKeys, LogInfo} from './logSleuth'
import {tryInOrder} from './util/try-in-order'
import {readLockfile} from './util/read-lockfile'
import {hasWorkspaceActionsBug} from './util/has-workspace-actions-bug'
import {openWebViewPopup} from './util/auth/open-webview-popup'
import {webviewLogout} from './util/auth/webview-logout'
import {AuthRedirectData} from './util/auth/parse-auth-redirect'
import {authFromRiotClient} from './util/auth/auth-from-riot-client'
import {checkWebViewData} from './util/auth/check-webview-data'
import {getRegion} from './util/auth/get-region'

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
    region?: string
    shard?: string
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
            await Promise.all([
                context.store.removeItem('successfulLogin'),
                context.store.removeItem('expiresAt'),
                context.store.removeItem('accessToken'),
                context.store.removeItem('entitlement'),
                context.store.removeItem('puuid')
            ])
            try {
                const data = await openWebViewPopup(context)
                await Promise.all([
                    context.store.setItem('successfulLogin', 'true'),
                    context.store.setItem('expiresAt', String((new Date()).getTime() + (Number(data.expiresIn) * 1000) - (5 * 60 * 1000))),
                    context.store.setItem('accessToken', data.accessToken),
                    context.store.setItem('entitlement', data.entitlement),
                    context.store.setItem('puuid', data.puuid)
                ])
            } catch (err) {
                await context.store.setItem('successfulLogin', 'false')
            }
        }
    },
    {
        label: 'Riot Logout',
        action: async (context: Context) => {
            await webviewLogout()
            await Promise.all([
                context.store.removeItem('successfulLogin'),
                context.store.removeItem('expiresAt'),
                context.store.removeItem('accessToken'),
                context.store.removeItem('entitlement'),
                context.store.removeItem('puuid')
            ])
        }
    }
]
if(hasWorkspaceActionsBug()) {
    module.exports.requestActions = module.exports.workspaceActions
}

let cachedCompleteLogInfo: LogInfo | undefined = undefined
let cachedAuthInfo: AuthRedirectData | undefined = undefined
let cachedRegionInfo: {region: string, shard: string} | undefined = undefined
let cachedClientVersion: string | undefined = undefined

async function getOrLoadLogInfo() {
    if (cachedCompleteLogInfo !== undefined) return cachedCompleteLogInfo

    const info = await logSleuth()
    if (!info) throw new Error('Could not find log info')
    for (const key of infoKeys) {
        if (info[key] === undefined) throw new Error(`Could not find log info for ${key}`)
    }
    cachedCompleteLogInfo = info as LogInfo

    return cachedCompleteLogInfo
}

async function getOrLoadAuthInfo() {
    if (cachedAuthInfo !== undefined) return cachedAuthInfo

    cachedAuthInfo = await tryInOrder([
        async () => await authFromRiotClient(),
        async () => await checkWebViewData()
    ])

    return cachedAuthInfo
}

async function getOrLoadRegionInfo() {
    if (cachedRegionInfo !== undefined) return cachedRegionInfo

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
            cachedRegionInfo = await getRegion(authInfo.accessToken, authInfo.entitlement)
            return cachedRegionInfo
        } catch(authError) {
            throw [logError, authError]
        }
    }

}

module.exports.templateTags = [
    {
        name: 'clientplatform',
        displayName: 'Client Platform',
        description: 'Valorant client platform',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.clientPlatform !== undefined && ctx.valorantOverrides.clientPlatform.length !== 0) return ctx.valorantOverrides.clientPlatform
            return 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
        }
    },
    {
        name: 'clientversion',
        displayName: 'Client Version',
        description: 'Valorant client version',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.clientVersion !== undefined && ctx.valorantOverrides.clientVersion.length !== 0) return ctx.valorantOverrides.clientVersion
            if(cachedClientVersion !== undefined) return cachedClientVersion
            //TODO the api endpoint and the logs have a different format for the version, need to check to ensure both work
            cachedClientVersion = await tryInOrder([
                async () => (await getOrLoadLogInfo()).clientVersion,
                async () => ((await (await fetch('https://valorant-api.com/v1/version')).json()) as ValorantAPIVersionResponse).data.riotClientVersion
            ])
            return cachedClientVersion
        }
    },
    {
        name: 'lockfileport',
        displayName: 'Lockfile Port',
        description: 'Valorant lockfile port',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.lockfilePort !== undefined && ctx.valorantOverrides.lockfilePort.length !== 0) return ctx.valorantOverrides.lockfilePort
            try {
                return (await readLockfile()).port
            } catch(e) {
                throw new Error('Lockfile not found! Is Valorant running?')
            }
        }
    },
    {
        name: 'lockfilepassword',
        displayName: 'Lockfile Password',
        description: 'Valorant lockfile password',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.lockfilePassword !== undefined && ctx.valorantOverrides.lockfilePassword.length !== 0) return ctx.valorantOverrides.lockfilePassword
            try {
                return (await readLockfile()).password
            } catch(e) {
                throw new Error('Lockfile not found! Is Valorant running?')
            }
        }
    },
    {
        name: 'puuid',
        displayName: 'PUUID',
        description: 'Valorant PUUID',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.puuid !== undefined && ctx.valorantOverrides.puuid.length !== 0) return ctx.valorantOverrides.puuid

            if(cachedAuthInfo !== undefined) return cachedAuthInfo.puuid
            if(cachedCompleteLogInfo !== undefined) return cachedCompleteLogInfo.puuid

            return await tryInOrder([
                async () => (await getOrLoadLogInfo()).puuid,
                async () => (await getOrLoadAuthInfo()).puuid
            ])
        }
    },
    {
        name: 'valorantregion',
        displayName: 'Region',
        description: 'Valorant account region',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.region !== undefined && ctx.valorantOverrides.region.length !== 0) return ctx.valorantOverrides.region
            if(cachedRegionInfo !== undefined) return cachedRegionInfo.region
            return (await getOrLoadRegionInfo()).region
        }
    },
    {
        name: 'valorantshard',
        displayName: 'Shard',
        description: 'Valorant account shard',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.shard !== undefined && ctx.valorantOverrides.shard.length !== 0) return ctx.valorantOverrides.shard
            if(cachedRegionInfo !== undefined) return cachedRegionInfo.shard
            return (await getOrLoadRegionInfo()).shard
        }
    },
    {
        name: 'valoranttoken',
        displayName: 'Token',
        description: 'Valorant auth token',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.token !== undefined && ctx.valorantOverrides.token.length !== 0) return ctx.valorantOverrides.token
            if(cachedAuthInfo !== undefined) return cachedAuthInfo.accessToken
            return (await getOrLoadAuthInfo()).accessToken
        }
    },
    {
        name: 'valorantentitlement',
        displayName: 'Entitlement',
        description: 'Valorant entitlement token',
        async run(ctx: TemplateTagContext) {
            if(ctx.valorantOverrides?.entitlement !== undefined && ctx.valorantOverrides.entitlement.length !== 0) return ctx.valorantOverrides.entitlement
            if(cachedAuthInfo !== undefined) return cachedAuthInfo.entitlement
            return (await getOrLoadAuthInfo()).entitlement
        }
    }
]