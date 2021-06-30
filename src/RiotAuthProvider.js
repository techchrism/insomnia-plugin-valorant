const EventEmitter = require('events').EventEmitter;
const electron = require('electron');
const nodeFetch = require('node-fetch');
const fetchCookie = require('fetch-cookie/node-fetch');
const tough = require('tough-cookie');

const signInUrl = 'https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token';

function getTokenDataFromURL(url)
{
    try
    {
        const searchParams = new URLSearchParams((new URL(url)).hash.slice(1));
        return {
            accessToken: searchParams.get('access_token'),
            expiresIn: searchParams.get('expires_in')
        };
    }
    catch(err)
    {
        throw new Error(`Bad url: "${url}"`);
    }
}

async function showSignIn()
{
    return new Promise((resolve, reject) =>
    {
        const loginWindow = new electron.remote.BrowserWindow({
            show: false,
            width: 470,
            height: 880,
            autoHideMenuBar: true
        });
        let foundToken = false;
        loginWindow.webContents.on('will-redirect', (event, url) =>
        {
            if(!foundToken && url.startsWith('https://playvalorant.com/opt_in'))
            {
                const tokenData = getTokenDataFromURL(url);
                foundToken = true;
            
                loginWindow.webContents.session.cookies.get({domain: 'auth.riotgames.com'}).then(cookies =>
                {
                    loginWindow.destroy();
                    resolve({
                        tokenData,
                        cookies
                    });
                });
            }
        });
        loginWindow.once('ready-to-show', () =>
        {
            loginWindow.show();
        });
        loginWindow.on('close', () =>
        {
            reject('window closed');
        });
        window.loginWindow = loginWindow;
        loginWindow.loadURL(signInUrl);
    });
}

class RiotAuthProvider extends EventEmitter
{
    constructor()
    {
        super();
        this.jar = new tough.CookieJar();
        this.fetch = fetchCookie(nodeFetch, this.jar);
        this.expiresAt = 0;
        this.token = null;
        this.entitlement = null;
        this.puuid = null;
        
        this.pending = null;
        this.store = null;
    }
    
    async clearAccount()
    {
        const cookieStore = electron.remote.getCurrentWindow().webContents.session.cookies;
        const cookies = await cookieStore.get({domain: 'auth.riotgames.com'});
        let removals = [];
        for(const cookie of cookies)
        {
            removals.push(cookieStore.remove(`https://${cookie.domain}${cookie.path}`, cookie.name));
        }
        await Promise.all(removals);
        if(this.store)
        {
            await Promise.all([
                this.store.removeItem('expiresAt'),
                this.store.removeItem('token'),
                this.store.removeItem('entitlement'),
                this.store.removeItem('puuid'),
                this.store.removeItem('cookies')
            ]);
        }
        this.jar.removeAllCookiesSync();
        
        this.expiresAt = 0;
        this.token = null;
        this.entitlement = null;
        this.puuid = null;
    }
    
    async logIn()
    {
        const data = await showSignIn();
        for(const cookie of data.cookies)
        {
            if(cookie.session) continue;
            
            this.jar.setCookieSync(new tough.Cookie({
                key: cookie.name,
                value: cookie.value,
                expires: new Date(cookie.expirationDate * 1000),
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly
            }), 'https://auth.riotgames.com/');
        }
        return data.tokenData;
    }
    
    hasLoginCookie()
    {
        return this.jar.getCookiesSync('https://auth.riotgames.com/').some(cookie => cookie.key === 'ssid' && cookie.expiryTime() > ((new Date()).getTime()));
    }
    
    async reauthToken()
    {
        const response = await this.fetch(signInUrl, {
            headers: {
                'User-Agent': ''
            },
            follow: 0,
            redirect: 'manual'
        });
        const redirectUri = response.headers.get('location');
        return getTokenDataFromURL(redirectUri);
    }
    
    async getEntitlement()
    {
        return (await (await this.fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json',
                'User-Agent': ''
            },
        })).json())['entitlements_token'];
    }
    
    async getPUUID()
    {
        return (await (await this.fetch('https://auth.riotgames.com/userinfo', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json',
                'User-Agent': ''
            },
        })).json())['sub'];
    }
    
    async _newInvoke(context)
    {
        if(!this.store)
        {
            this.store = context.store;
        }
        
        if(this.expiresAt === 0)
        {
            if(await context.store.hasItem('expiresAt'))
            {
                this.expiresAt = parseInt(await context.store.getItem('expiresAt'));
                this.token = await context.store.getItem('token');
                this.entitlement = await context.store.getItem('entitlement');
                this.puuid = await context.store.getItem('puuid');
                
                this.jar = tough.CookieJar.deserializeSync(await context.store.getItem('cookies'));
                this.fetch = fetchCookie(nodeFetch, this.jar);
            }
        }
        
        const currentTime = (new Date()).getTime();
        // Regenerate token after expiration
        if(this.expiresAt <= currentTime)
        {
            let tokenData = {};
            try
            {
                if(this.hasLoginCookie())
                {
                    console.log('Login cookie found');
                    try
                    {
                        tokenData = await this.reauthToken();
                    }
                    catch(e)
                    {
                        tokenData = await this.logIn();
                    }
                }
                else
                {
                    console.log('No login cookie');
                    tokenData = await this.logIn();
                    console.log('Token data:');
                    console.log(tokenData);
                }
            }
            catch(e)
            {
                console.error(e);
                throw new Error('Riot login failed');
            }
            
            this.token = tokenData.accessToken;
            this.entitlement = await this.getEntitlement();
            this.puuid = await this.getPUUID();
            
            // Subtract 5 minutes to avoid expiration race cases
            this.expiresAt = (new Date()).getTime() + (tokenData.expiresIn * 1000) - (5 * 60 * 1000);
            
            await Promise.all([
                context.store.setItem('expiresAt', this.expiresAt),
                context.store.setItem('cookies', JSON.stringify(this.jar.serializeSync())),
                context.store.setItem('token', this.token),
                context.store.setItem('entitlement', this.entitlement),
                context.store.setItem('puuid', this.puuid)
            ]);
        }
        
        return {
            entitlement: this.entitlement,
            token: this.token,
            puuid: this.puuid
        };
    }
    
    async invoke(context)
    {
        if(!this.pending)
        {
            this.pending = this._newInvoke(context);
        }
        try
        {
            return await this.pending;
        }
        catch(e)
        {
            throw e;
        }
        finally
        {
            this.pending = null;
        }
    }
}

module.exports = RiotAuthProvider;
