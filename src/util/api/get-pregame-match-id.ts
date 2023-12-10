import fetch from 'node-fetch'

export async function getPregameMatchId(shard: string, region: string, puuid: string, accessToken: string, entitlement: string) {
    const response = await fetch(`https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/players/${puuid}`, {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'X-Riot-Entitlements-JWT': entitlement,
            'User-Agent': ''
        },
    })

    if(response.status === 404) throw new Error('Player is not in a pregame lobby')
    return (await response.json() as any)['MatchID'] as string
}