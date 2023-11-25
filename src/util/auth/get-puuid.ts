export async function getPUUID(accessToken: string): Promise<string> {
    return (await (await fetch('https://auth.riotgames.com/userinfo', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'User-Agent': ''
        },
    })).json())['sub'] as string
}