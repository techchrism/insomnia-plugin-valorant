import {promises as fs} from 'node:fs'
import path from 'node:path'

interface LockFileData {
    name: string
    pid: string
    port: string
    password: string
    protocol: string
}

export async function readLockfile(): Promise<LockFileData> {
    const split = (await fs.readFile(path.join(process.env['LOCALAPPDATA'] ?? '', 'Riot Games\\Riot Client\\Config\\lockfile'), 'utf-8')).split(':')
    return {
        name: split[0],
        pid: split[1],
        port: split[2],
        password: split[3],
        protocol: split[4]
    }
}