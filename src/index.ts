import logSleuth, {infoKeys, LogInfo} from './logSleuth'
import {tryInOrder} from './util/try-in-order'

interface ValorantAPIVersionResponse {
    data: {
        riotClientVersion: string
    }
}

export const workspaceActions = [
    {
        label: 'Remove Saved Valorant Data',
        async action(context: any) {
            await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)))
        }
    }
];

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
        async run() {
            return 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
        }
    },
    {
        name: 'clientversion',
        displayName: 'Client Version',
        description: 'Valorant client version',
        async run() {
            if(cachedClientVersion !== undefined) return cachedClientVersion
            //TODO the api endpoint and the logs have a different format for the version, need to check to ensure both work
            cachedClientVersion = await tryInOrder([
                async () => (await getOrLoadLogInfo()).clientVersion,
                async () => ((await (await fetch('https://valorant-api.com/v1/version')).json()) as ValorantAPIVersionResponse).data.riotClientVersion
            ])
            return cachedClientVersion
        }
    }
]