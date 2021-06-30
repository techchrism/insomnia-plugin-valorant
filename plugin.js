const remoteApi = require('./src/remoteAPI');
const localApi = require('./src/localAPI');

module.exports.templateTags = [
    ...remoteApi.templateTags,
    ...localApi.templateTags
]

module.exports.workspaceActions = [
    ...remoteApi.workspaceActions,
    ...localApi.workspaceActions
];
