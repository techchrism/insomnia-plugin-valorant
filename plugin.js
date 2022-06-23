const remoteApi = require('./src/remoteAPI');
const os = require('os');

module.exports.templateTags = [...remoteApi.templateTags];

module.exports.workspaceActions = [
    ...remoteApi.workspaceActions,
    {
        label: 'Remove Saved Valorant Data',
        async action(context) {
            await Promise.all(['expiresAt', 'cookies', 'token', 'entitlement', 'puuid', 'region'].map(key => context.store.removeItem(key)));
            window.context = context;
        }
    }
];

if (os.platform() === 'win32') {
    const localApi = require('./src/localAPI');
    module.exports.templateTags.push(...localApi.templateTags);
    module.exports.workspaceActions.push(...localApi.workspaceActions);
}
