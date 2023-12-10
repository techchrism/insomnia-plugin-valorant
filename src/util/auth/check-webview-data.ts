import {WebviewTag} from 'electron'
import {parseAuthRedirect} from './parse-auth-redirect'

/**
 * Checks if the webview partition has valid login data
 * If so, the promise resolves with the access token and expiration time
 * If not, the promise rejects with an error message
 */
export async function checkWebViewData() {
    return new Promise<ReturnType<typeof parseAuthRedirect>>(async (resolve, reject) => {
        const valRefreshWebView = document.createElement('webview') as WebviewTag
        valRefreshWebView.style.display = 'none'
        valRefreshWebView.nodeintegration = false
        // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
        valRefreshWebView.partition = 'persist:valorant'

        const checkForToken = async (event: Electron.DidNavigateEvent) => {
            if (event.url.startsWith('https://playvalorant.com/') && event.url.includes('access_token')) {
                cleanupWebView()
                try {
                    resolve(parseAuthRedirect(event.url))
                } catch(e) {
                    reject(e)
                }
            } else if (event.url.startsWith('https://authenticate.riotgames.com/')) {
                cleanupWebView()
                reject('No login data found or login data expired')
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
