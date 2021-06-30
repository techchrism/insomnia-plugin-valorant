const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const EventEmitter = require('events').EventEmitter;
const logParser = require('../logParser');

const localAgent = new https.Agent({
    rejectUnauthorized: false
});
const lockfilePath = path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\lockfile');
const regions = ['na','ko','eu','ap'];

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
        this.lockFileData = null;
        this.localData = null;
        this.clientVersion = null;
        this.region = null;
        
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
            this.lockFileData = await getLockfileData();
            this.localData = await loadLocalData(this.lockFileData.port, this.lockFileData.password);
            this.emit('update');
        }
        catch(e)
        {
            console.error(e);
            this.lockFileData = null;
            this.localData = null;
        }
    }
    
    async refreshClientVersion()
    {
        try
        {
            // First try reading log
            this.clientVersion = await logParser.getClientVersion();
        }
        catch(ignored)
        {
            // Next, try the unofficial api
            const apiData = await (await fetch('https://valorant-api.com/v1/version')).json();
            this.clientVersion = apiData.data['riotClientVersion'];
        }
        return this.clientVersion;
    }
    
    async getClientVersion()
    {
        if(this.clientVersion === null)
        {
            await this.refreshClientVersion();
        }
        return this.clientVersion;
    }
    
    async manuallySetRegion(context)
    {
        const region = (await context.app.prompt('Please Enter Valorant Region', {
            label: `Must be one of [${regions.join(' | ')}]`
        })).toLowerCase();
        if(!regions.includes(region))
        {
            throw new Error('Invalid region');
        }
        
        this.region = region;
        await context.store.setItem('region', this.region);
    }
    
    async getRegion(context)
    {
        if(this.region === null)
        {
            // Check if there's a saved version
            if(context.store.hasItem('region'))
            {
                this.region = await context.store.getItem('region');
            }
            else
            {
                // Try reading region from log
                try
                {
                    this.region = await logParser.getRegion();
                    await context.store.setItem('region', this.region);
                }
                catch(ignored)
                {
                    // Finally, just ask the user for a region
                    await this.manuallySetRegion(context);
                }
            }
        }
        return this.region;
    }
    
    close()
    {
        this.watcher.close();
    }
}

module.exports = LocalInfoProvider;
