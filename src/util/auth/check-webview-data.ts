import {WebviewTag} from 'electron'

/**
 * Checks if the webview partition has valid login data
 * If so, the promise resolves with the access token and expiration time
 * If not, the promise rejects with an error message
 */
export async function checkWebViewData() {
    return new Promise<{accessToken: string, entitlement: string, expiresIn: string}>(async (resolve, reject) => {
        const valRefreshWebView = document.createElement('webview') as WebviewTag
        valRefreshWebView.style.display = 'none'
        valRefreshWebView.nodeintegration = false
        // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
        valRefreshWebView.partition = 'persist:valorant'

        const checkForToken = async (event: Electron.DidNavigateEvent) => {
            if (event.url.startsWith('https://playvalorant.com/') && event.url.includes('access_token')) {
                cleanupWebView()

                // Load data
                const searchParams = new URLSearchParams((new URL(event.url)).hash.slice(1))
                const accessToken = searchParams.get('access_token')
                const entitlement = searchParams.get('id_token')
                const expiresIn = searchParams.get('expires_in')
                if(accessToken === null || entitlement === null || expiresIn === null) {
                    cleanupWebView()
                    reject('Invalid access token, entitlement, or expiry')
                } else {
                    cleanupWebView()
                    resolve({accessToken, entitlement, expiresIn})
                }
            } else if (event.url.startsWith('https://authenticate.riotgames.com/login')) {
                cleanupWebView()
                reject('Waiting for sign in')
            }
        }

        const cleanupWebView = () => {
            valRefreshWebView.removeEventListener('did-navigate', checkForToken)
            // Ignore errors relating to the webview not being attached to the dom
            try {
                valRefreshWebView.stop()
            } catch(ignored) {}
            document.body.removeChild(valRefreshWebView)
        }

        valRefreshWebView.addEventListener('did-navigate', checkForToken)

        valRefreshWebView.src = 'https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in%2F&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid'
        document.body.appendChild(valRefreshWebView)
    })
}
