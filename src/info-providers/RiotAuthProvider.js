const nodeFetch = require('node-fetch');
const fetchCookie = require('fetch-cookie/node-fetch');
const tough = require('tough-cookie');
const logger = require('../logger');

const signInUrl = 'https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in%2F&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid';
const signInError = `Riot Account Not Signed In - 
To sign in, click the collection dropdown at the top center (above the send button) then click "Sign in to Riot account".`

function getTokenDataFromURL(url) {
    try {
        const searchParams = new URLSearchParams((new URL(url)).hash.slice(1));
        return {
            accessToken: searchParams.get('access_token'),
            expiresIn: searchParams.get('expires_in')
        };
    } catch (err) {
        throw new Error(`Bad url: "${url}"`);
    }
}

class RiotAuthProvider {
    constructor() {
        this.expiresAt = 0;
        this.token = null;
        this.entitlement = null;
        this.puuid = null;

        this.waitingForSignIn = false;

        this.pending = null;
        this.store = null;
    }

    checkStore(store) {
        if (this.store === null) {
            this.store = store;
        }
    }

    async loadDataFromURL(url, context) {
        this.waitingForSignIn = false;
        const tokenData = getTokenDataFromURL(url);
        this.token = tokenData.accessToken;
        logger.info('Loading entitlement and puuid');
        this.entitlement = await this.getEntitlement();
        this.puuid = await this.getPUUID();

        // Subtract 5 minutes to avoid expiration race cases
        this.expiresAt = (new Date()).getTime() + (tokenData.expiresIn * 1000) - (5 * 60 * 1000);

        await Promise.all([
            context.store.setItem('expiresAt', this.expiresAt),
            context.store.setItem('token', this.token),
            context.store.setItem('entitlement', this.entitlement),
            context.store.setItem('puuid', this.puuid)
        ]);
    }

    async signOut() {
        logger.info('Signing out...');
        this.expiresAt = 0;
        this.token = null;
        this.entitlement = null;
        this.puuid = null;
        if (this.store) {
            logger.info('Clearing saved store items');
            await Promise.all([
                this.store.removeItem('expiresAt'),
                this.store.removeItem('token'),
                this.store.removeItem('entitlement'),
                this.store.removeItem('puuid')
            ]);
        }
        return new Promise((resolve, reject) => {
            const valLogoutWebView = document.createElement('webview');
            valLogoutWebView.style.display = 'none';
            valLogoutWebView.nodeIntegration = false;
            // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
            valLogoutWebView.partition = 'persist:valorant';

            valLogoutWebView.addEventListener('did-navigate', function navigateHandler(event) {
                if (event.url === 'https://auth.riotgames.com/logout') {
                    logger.info('Confirmed signed out');
                    valLogoutWebView.stop();
                    valLogoutWebView.removeEventListener('did-navigate', navigateHandler);
                    document.body.removeChild(valLogoutWebView);
                    this.waitingForSignIn = true;
                    resolve();
                }
            });

            valLogoutWebView.src = 'https://auth.riotgames.com/logout';
            document.body.appendChild(valLogoutWebView);
        });
    }

    async signIn(context) {
        // Sign out because it's unclear if an account is currently signed in
        // This can happen when the action is initiated before a token retrieval attempt happens
        if (!this.waitingForSignIn) {
            await this.signOut();
        }

        logger.info('Signing in...');
        return new Promise((resolve, reject) => {
            const valWebView = document.createElement('webview');
            valWebView.style.display = 'none';
            valWebView.classList.add('val-webview');
            valWebView.nodeIntegration = false;
            // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
            valWebView.partition = 'persist:valorant';

            let shownSignIn = false;
            let readyForHide = false;
            let cleanedUp = false;

            // Event handler to check for tokens in the urls of navigated and redirected events
            const checkForToken = async (event) => {
                if (event.url.startsWith('https://playvalorant.com/') && event.url.includes('access_token')) {
                    cleanupWebView();

                    // Close model
                    if (shownSignIn) {
                        const closeButtons = document.getElementsByClassName('modal__close-btn');
                        if (closeButtons.length === 0) {
                            logger.warning('No close buttons found for open model');
                        } else {
                            if (closeButtons.length > 1) {
                                logger.warning('Found multiple close buttons! Closing them all.');
                            }
                            readyForHide = true;
                            for (const closeButton of closeButtons) {
                                closeButton.click();
                            }
                        }
                    }

                    // Load data
                    await this.loadDataFromURL(event.url, context);

                    logger.info('Done signing in');
                    resolve();
                }
            };

            // Event handler for when the modal is closed
            const hideHandler = () => {
                cleanupWebView();

                if (!readyForHide) {
                    reject('Window closed');
                }
            }

            const redirectHandler = (event) => {
                checkForToken(event);
            };

            const navigateHandler = (event) => {
                if (event.url.startsWith('https://auth.riotgames.com/login') && !shownSignIn) {
                    shownSignIn = true;
                    logger.info('Showing sign in page...');

                    // Add styling to dom
                    const styleID = 'val-auth-style';
                    if(document.getElementById(styleID) === null) {
                        const style = document.createElement('style');
                        style.id = styleID;
                        style.innerHTML = `
                        div:has(> .val-webview) {
                            height: 100%;
                        }
                        `;
                        document.head.appendChild(style);
                    }

                    document.body.removeChild(valWebView);
                    valWebView.style.removeProperty('display');
                    context.app.dialog('Riot Sign In', valWebView, {
                        tall: true,
                        wide: true,
                        onHide: hideHandler
                    });
                }
                checkForToken(event);
            };

            const cleanupWebView = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                valWebView.removeEventListener('did-redirect-navigation', redirectHandler);
                valWebView.removeEventListener('did-navigate', navigateHandler);
                valWebView.stop();
                if (!shownSignIn) {
                    document.body.removeChild(valWebView);
                }
            }

            valWebView.addEventListener('did-redirect-navigation', redirectHandler);
            valWebView.addEventListener('did-navigate', navigateHandler);

            valWebView.src = signInUrl;
            document.body.appendChild(valWebView);
        });
    }

    async refreshData(context) {
        return new Promise(async (resolve, reject) => {
            const valRefreshWebView = document.createElement('webview');
            valRefreshWebView.style.display = 'none';
            valRefreshWebView.nodeIntegration = false;
            // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
            valRefreshWebView.partition = 'persist:valorant';

            const checkForToken = async (event) => {
                if (event.url.startsWith('https://playvalorant.com/') && event.url.includes('access_token')) {
                    cleanupWebView();
                    await this.loadDataFromURL(event.url, context);
                    resolve();
                } else if (event.url.startsWith('https://auth.riotgames.com/login')) {
                    cleanupWebView();
                    this.waitingForSignIn = true;
                    reject('Waiting for sign in');
                }
            };

            const navigateHandler = async (event) => {
                await checkForToken(event);
            };

            const cleanupWebView = () => {
                valRefreshWebView.removeEventListener('did-navigate', navigateHandler);
                document.body.removeChild(valRefreshWebView);
            }

            valRefreshWebView.addEventListener('did-navigate', navigateHandler);

            valRefreshWebView.src = signInUrl;
            document.body.appendChild(valRefreshWebView);
        });
    }

    async getEntitlement() {
        return (await (await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json',
                'User-Agent': ''
            },
        })).json())['entitlements_token'];
    }

    async getPUUID() {
        return (await (await fetch('https://auth.riotgames.com/userinfo', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json',
                'User-Agent': ''
            },
        })).json())['sub'];
    }

    async _newInvoke(context) {
        this.checkStore(context.store);

        if (this.expiresAt === 0 && !this.waitingForSignIn) {
            if (await context.store.hasItem('expiresAt')) {
                logger.info('Loading saved Riot data from store');
                this.expiresAt = parseInt(await context.store.getItem('expiresAt'));
                this.token = await context.store.getItem('token');
                this.entitlement = await context.store.getItem('entitlement');
                this.puuid = await context.store.getItem('puuid');
            }
        }

        const currentTime = (new Date()).getTime();
        // Regenerate token after expiration
        if (this.expiresAt <= currentTime) {
            if (this.waitingForSignIn) {
                throw new Error(signInError);
            }

            logger.info('Token has expired, attempting regeneration...');
            try {
                await this.refreshData(context);
            } catch (e) {
                this.waitingForSignIn = true;
                throw new Error(signInError);
            }

            this.waitingForSignIn = false;
        }

        return {
            entitlement: this.entitlement,
            token: this.token,
            puuid: this.puuid
        };
    }

    async invoke(context) {
        if (!this.pending) {
            this.pending = this._newInvoke(context);
        }
        try {
            return await this.pending;
        } catch (e) {
            throw e;
        } finally {
            this.pending = null;
        }
    }
}

module.exports = RiotAuthProvider;
