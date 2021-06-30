const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const EventEmitter = require('events').EventEmitter;

const localAgent = new https.Agent({
    rejectUnauthorized: false
});
const lockfilePath = path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\lockfile');

async function getLockfileData()
{
    const contents = await fs.promises.readFile(lockfilePath, 'utf8');
    let d = {};
    [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(':');
    return d;
}

async function getLocalAPI(port, password, path)
{
    return (await fetch(`https://127.0.0.1:${port}/${path}`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

async function asyncTimeout(delay)
{
    return new Promise(resolve =>
    {
        setTimeout(resolve, delay);
    });
}

async function waitForExternalSession(port, password)
{
    let data = {};
    while(true)
    {
        data = await getLocalAPI(port, password, 'product-session/v1/external-sessions');
        if(Object.keys(data).length === 0)
        {
            await asyncTimeout(1000);
        }
        else
        {
            break;
        }
    }
    return data;
}

async function loadLocalData(port, password, retryCount = 0, delay = 1500)
{
    for(let tries = 0; retryCount === -1 || tries <= retryCount; tries++)
    {
        try
        {
            const sessionData = await getLocalAPI(port, password, 'chat/v1/session');
            const externalSessions = await waitForExternalSession(port, password);
            
            return {
                sessionData,
                externalSessions
            };
        }
        catch(e)
        {
            if(retryCount === -1 || tries < retryCount)
            {
                await asyncTimeout(delay);
            }
        }
    }
    throw new Error('Retry limit reached');
}

class LocalInfoProvider extends EventEmitter
{
    constructor()
    {
        super();
        this.info = {
            lockFileData: null,
            localData: null
        };
        this.watcher = fs.watch(path.dirname(lockfilePath), async (eventType, fileName) =>
        {
            if(eventType === 'rename' && fileName === 'lockfile')
            {
                await this.tryUpdateInfo();
            }
        });
        this.tryUpdateInfo();
    }
    
    async tryUpdateInfo()
    {
        try
        {
            this.info.lockFileData = await getLockfileData();
            this.info.localData = await loadLocalData(this.info.lockFileData.port, this.info.lockFileData.password);
            this.emit('update', this.info);
        }
        catch(e)
        {
            this.info.lockFileData = null;
            this.info.localData = null;
        }
    }
    
    close()
    {
        this.watcher.close();
    }
}

module.exports = LocalInfoProvider;
