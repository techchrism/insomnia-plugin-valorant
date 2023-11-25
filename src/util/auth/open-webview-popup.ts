import {WebviewTag} from 'electron'

/**
 * Opens a popup window to sign in to Riot
 * The promise resolves with the access token and expiration time
 * If the window is closed, the promise rejects with an error message
 * @param context The Insomnia context, used for opening a dialog element
 */
export async function openWebViewPopup(context: any) {
    return new Promise<{accessToken: string, expiresIn: string}>((resolve, reject) => {
        const valWebView = document.createElement('webview') as WebviewTag
        valWebView.style.display = 'none'
        valWebView.classList.add('val-webview')
        valWebView.nodeintegration = false
        // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
        valWebView.partition = 'persist:valorant'

        let shownSignIn = false
        let readyForHide = false
        let cleanedUp = false

        // Event handler to check for tokens in the urls of navigated and redirected events
        const checkForToken = async (event: Electron.DidRedirectNavigationEvent | Electron.DidNavigateEvent) => {
            if (event.url.startsWith('https://playvalorant.com/') && event.url.includes('access_token')) {
                cleanupWebView()

                // Close model
                if(shownSignIn) {
                    const closeButtons = document.getElementsByClassName('modal__close-btn') as HTMLCollectionOf<HTMLButtonElement>
                    if(closeButtons.length !== 0) {
                        readyForHide = true
                        for(const closeButton of closeButtons) {
                            closeButton.click()
                        }
                    }
                }

                // Load data
                const searchParams = new URLSearchParams((new URL(event.url)).hash.slice(1))
                const accessToken = searchParams.get('access_token')
                const expiresIn = searchParams.get('expires_in')
                if(accessToken === null || expiresIn === null) {
                    cleanupWebView()
                    reject('Invalid access token')
                } else {
                    cleanupWebView()
                    resolve({accessToken, expiresIn})
                }
            }
        }

        // Event handler for when the modal is closed
        const hideHandler = () => {
            cleanupWebView()
            if(!readyForHide) {
                reject('Window closed')
            }
        }

        const redirectHandler = (event: Electron.DidRedirectNavigationEvent) => {
            checkForToken(event)
        }

        const navigateHandler = (event: Electron.DidNavigateEvent) => {
            if (event.url.startsWith('https://authenticate.riotgames.com') && !shownSignIn) {
                shownSignIn = true

                // Add styling to dom
                const styleID = 'val-auth-style'
                if(document.getElementById(styleID) === null) {
                    const style = document.createElement('style')
                    style.id = styleID
                    style.innerHTML = `
                        div:has(> .val-webview) {
                            height: 100%;
                        }
                        `
                    document.head.appendChild(style)
                }

                document.body.removeChild(valWebView)
                valWebView.style.removeProperty('display')
                context.app.dialog('Riot Sign In', valWebView, {
                    tall: true,
                    wide: true,
                    onHide: hideHandler
                })
            }
            checkForToken(event)
        }

        const cleanupWebView = () => {
            if(cleanedUp) return
            cleanedUp = true
            valWebView.removeEventListener('did-redirect-navigation', redirectHandler)
            valWebView.removeEventListener('did-navigate', navigateHandler)
            // Ignore errors relating to the webview not being attached to the dom
            try {
                valWebView.stop()
            } catch(ignored) {}
            if (!shownSignIn) {
                document.body.removeChild(valWebView)
            }
        }

        valWebView.addEventListener('did-redirect-navigation', redirectHandler)
        valWebView.addEventListener('did-navigate', navigateHandler)

        valWebView.src = 'https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in%2F&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid'
        document.body.appendChild(valWebView)
    })
}
