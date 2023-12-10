import fetch from 'node-fetch'

export async function getPASToken(accessToken: string) {
    return await (await fetch('https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat', {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'User-Agent': ''
        },
    })).text()
}