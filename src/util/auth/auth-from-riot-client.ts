import {promises as fs} from 'node:fs'
import path from 'node:path'
import fetch from 'node-fetch'
import {parseAuthRedirect} from './parse-auth-redirect'

function ellipsis(str: string, length: number) {
    return str.length > length ? str.slice(0, length - 3) + '...' : str
}

async function ssidReauth(ssid: string) {
    const response = await fetch('https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid', {
        method: 'GET',
        redirect: 'manual',
        headers: {
            'User-Agent': '',
            'Cookie': 'ssid=' + ssid
        }
    })

    const location = response.headers.get('location')
    if(location === null) throw new Error('No location header in response!')
    if(!location.startsWith('https://playvalorant.com/opt_in')) throw new Error(`Invalid reauth location: ${ellipsis(location, 40)}`)

    return parseAuthRedirect(location)
}

/**
 * Uses the ssid from the Riot Client `RiotGamesPrivateSettings.yaml` file for auth
 */
export async function authFromRiotClient() {
    const settings = await fs.readFile(path.join(process.env['LOCALAPPDATA'] ?? '', 'Riot Games\\Riot Client\\Data\\RiotGamesPrivateSettings.yaml'), 'utf-8')

    // Yeah, this regex isn't guaranteed to work in the future, but it works for now and it means I don't have to pull in a yaml parser
    const match = /name: "ssid".*?value: "(.+?)"/s.exec(settings)
    if(match === null) {
        throw new Error('Could not find ssid in RiotGamesPrivateSettings.yaml')
    }
    const ssid = match[1]

    // Basic validity check
    if(ssid.split('.').length !== 3) {
        throw new Error('Invalid ssid')
    }

    // As observed from https://github.com/techchrism/riot-auth-test the ssid reauth might fail but works on a retry
    const errors = []
    for(let i = 0; i < 3; i++) {
        try {
            return await ssidReauth(ssid)
        } catch(e) {
            errors.push(e)
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000))
        }
    }
    /*
        When I was testing, my ssid cookie from the Riot client wasn't working with reauth which was odd because Valorant and the Riot client both operated normally
        It had been a while since I had logged out, so I logged out then back in, and the ssid cookie worked with reauth
        I'm not sure why this was the case but if you have any information, let me know
     */
    throw new Error(`Failed to reauth after ${errors.length} attempts:\n` +
        errors.map(e => ` - ${(e as any).toString().split('\n').join('\n   ')}`).join('\n') + // Errors as bullet point list with indentation
        '\nThis might be solved by opening the Riot client, signing out, and signing back in.')
}