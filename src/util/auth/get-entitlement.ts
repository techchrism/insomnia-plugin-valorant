import fetch from 'node-fetch'

export async function getEntitlement(accessToken: string) {
    return (await (await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'User-Agent': ''
        },
    })).json() as any)['entitlements_token'] as string
}