import fetch from 'node-fetch'

export async function getCurrentGameMatchId(shard: string, region: string, puuid: string, accessToken: string, entitlement: string) {
    const response = await fetch(`https://glz-${region}-1.${shard}.a.pvp.net/core-game/v1/players/${puuid}`, {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'X-Riot-Entitlements-JWT': entitlement,
            'User-Agent': ''
        },
    })

    if(response.status === 404) throw new Error('Player is not in an active match (after the agent select screen)')
    return (await response.json() as any)['MatchID'] as string
}