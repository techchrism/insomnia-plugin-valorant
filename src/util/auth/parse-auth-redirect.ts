function throwExpression(errorMessage: string): never {
    throw new Error(errorMessage)
}

export function parseAuthRedirect(url: string) {
    const searchParams = new URLSearchParams((new URL(url)).hash.slice(1))
    const accessToken = searchParams.get('access_token') ?? throwExpression('Access token missing from url')
    const entitlement = searchParams.get('id_token') ?? throwExpression('Entitlement missing from url')
    const expiresIn = searchParams.get('expires_in') ?? throwExpression('Expiry missing from url')

    const accessTokenParts = accessToken.split('.')
    if(accessTokenParts.length !== 3) throw new Error(`Invalid access token, expected 3 parts, got ${accessTokenParts.length}`)
    const accessTokenData = JSON.parse(Buffer.from(accessTokenParts[1], 'base64').toString('utf-8'))

    if(accessTokenData.sub === undefined) throw new Error('Invalid access token, missing sub')

    return {
        accessToken,
        entitlement,
        expiresIn,
        puuid: accessTokenData.sub
    }
}