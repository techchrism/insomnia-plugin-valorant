const remoteApi = require('./src/remoteAPI');
const localApi = require('./src/localAPI');

module.exports.templateTags = [
    ...remoteApi.templateTags,
    ...localApi.templateTags
]

module.exports.workspaceActions = [
    ...remoteApi.workspaceActions,
    ...localApi.workspaceActions,
    {
        label: 'Remove Saved Valorant Data',
        async action(context)
        {
            await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)));
            window.context = context;
        }
    }
];
