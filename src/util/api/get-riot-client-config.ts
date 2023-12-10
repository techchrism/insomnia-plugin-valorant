import fetch from 'node-fetch'

export interface RiotConfigResponse {
    'chat.affinities': {
        [key: string]: string
    }
    'chat.affinity_domains': {
        [key: string]: string
    }
}

export async function getRiotClientConfig(token: string, entitlement: string): Promise<RiotConfigResponse> {
    return (await (await fetch('https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client', {
        headers: {
            'User-Agent': '',
            'Authorization': `Bearer ${token}`,
            'X-Riot-Entitlements-JWT': entitlement
        }
    })).json()) as RiotConfigResponse
}