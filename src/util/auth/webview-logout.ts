/**
 * Logs out of the Riot auth system by opening a hidden webview and navigating to the logout page
 */
export async function webviewLogout() {
    return new Promise<void>((resolve, reject) => {
        const valLogoutWebView = document.createElement('webview')
        valLogoutWebView.style.display = 'none'
        valLogoutWebView.nodeintegration = false
        // Set partition to avoid Insomnia stripping out the Origin headers needed for CORS
        valLogoutWebView.partition = 'persist:valorant'

        valLogoutWebView.addEventListener('did-navigate', function navigateHandler(event) {
            if(event.url === 'https://auth.riotgames.com/logout') {
                // Ignore errors relating to the webview not being attached to the dom
                try {
                    valLogoutWebView.stop()
                } catch(ignored) {}
                valLogoutWebView.removeEventListener('did-navigate', navigateHandler)
                document.body.removeChild(valLogoutWebView)
                resolve()
            }
        })

        valLogoutWebView.src = 'https://auth.riotgames.com/logout'
        document.body.appendChild(valLogoutWebView)
    })
}