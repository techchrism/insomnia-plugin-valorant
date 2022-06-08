const remoteApi = require('./src/remoteAPI');
const localApi = require('./src/localAPI');
const os = require('os');

module.exports.templateTags = [...remoteApi.templateTags];

module.exports.workspaceActions = [
    ...remoteApi.workspaceActions,
    {
        label: 'Remove Saved Valorant Data',
        async action(context)
        {
            await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)));
            window.context = context;
        }
    }
];

if(os.platform() === 'win32') {
    module.exports.templateTags.push(...localApi.templateTags);
    module.exports.workspaceActions.push(...localApi.workspaceActions);
}
