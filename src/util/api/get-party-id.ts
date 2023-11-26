import fetch from 'node-fetch'

export async function getPartyId(shard: string, region: string, puuid: string, clientVersion: string, accessToken: string, entitlement: string) {
    const response = await fetch(`https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/players/${puuid}`, {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'X-Riot-Entitlements-JWT': entitlement,
            'X-Riot-ClientVersion': clientVersion,
            'User-Agent': ''
        },
    })

    if(response.status === 404) throw new Error('Player is not in a party. Is Valorant running?')
    return (await response.json() as any)['CurrentPartyID'] as string
}