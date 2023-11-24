import logSleuth, {infoKeys, LogInfo} from './logSleuth'
import {tryInOrder} from './util/try-in-order'
import {readLockfile} from './util/read-lockfile'
import {hasWorkspaceActionsBug} from './util/has-workspace-actions-bug'

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
}

interface TemplateTagContext {
    valorantOverrides?: ValorantOverrides
}

const clearValorantData = async (context: any) => {
    await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)))
    context['app'].alert('Cleared Valorant data!')
}
module.exports.workspaceActions = [
    {
        label: 'Remove Saved Valorant Data',
        action: clearValorantData
    }
]
if(hasWorkspaceActionsBug()) {
    module.exports.requestActions = module.exports.workspaceActions
}

let cachedCompleteLogInfo: LogInfo
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
    }
]