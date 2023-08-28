import logSleuth from './logSleuth'

export const workspaceActions = [
    {
        label: 'Remove Saved Valorant Data',
        async action(context: any) {
            await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)))
        }
    }
];

(async () => {
    console.log(await logSleuth())
})()