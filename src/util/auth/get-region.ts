import fetch from 'node-fetch'

const regionToShardMap = new Map<string, string>([
    ['na', 'na'],
    ['latam', 'na'],
    ['br', 'na'],
    ['eu', 'eu'],
    ['ap', 'ap'],
    ['kr', 'kr']
])

/**
 * Get the region and shard from a token and entitlement
 * @param token The auth token
 * @param entitlement The entitlement token
 */
export async function getRegion(token: string, entitlement: string) {
    const region = (await (await fetch('https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant', {
        method: 'PUT',
        body: JSON.stringify({id_token: entitlement}),
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': ''
        }
    })).json() as any)['affinities']['live'] as string

    const shard = regionToShardMap.get(region)
    if(shard === undefined) throw new Error(`Unknown region: ${region}`)

    return {region, shard}
}