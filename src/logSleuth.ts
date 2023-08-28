import * as fs from 'node:fs'
import * as readline from 'node:readline'
import * as path from 'path'

const infoKeys = ['puuid', 'shard', 'region', 'clientVersion'] as const

const puuidRegex = new RegExp('Logged in user changed: (.+)', 'g')
const regionShardRegex = new RegExp('https://glz-(.+?)-1.(.+?).a.pvp.net', 'g')
const clientVersionRegex = new RegExp('CI server version: (.+)', 'g')

// From https://stackoverflow.com/a/51399781
type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never

export type LogInfo = {
    [key in ArrayElement<typeof infoKeys>]: string
}

async function sleuth(file: string): Promise<Partial<LogInfo>> {
    const info: Partial<LogInfo> = {}

    const fileStream = fs.createReadStream(file)
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    })

    for await(const line of rl) {
        if(info.puuid === undefined) {
            const match = puuidRegex.exec(line)
            if(match) {
                info.puuid = match[1]
            }
        }

        if(info.shard === undefined || info.region === undefined) {
            const match = regionShardRegex.exec(line)
            if(match) {
                info.region = match[1]
                info.shard = match[2]
            }
        }

        if(info.clientVersion === undefined) {
            const match = clientVersionRegex.exec(line)
            if(match) {
                info.clientVersion = match[1]
            }
        }

        if(infoKeys.every(key => info[key] !== undefined)) break
    }

    return info
}

export default async function logSleuth(): Promise<Partial<LogInfo> | undefined> {
    // Might expand in the future to include older log files if needed
    const filePath = path.join(process.env['LOCALAPPDATA']!, 'VALORANT\\Saved\\Logs\\ShooterGame.log')
    try {
        return await sleuth(filePath)
    } catch(e) {
        return undefined
    }
}