const LocalInfoProvider = require('./src/info-providers/LocalInfoProvider');
const remoteApi = require('./src/remoteAPI');

const localInfoProvider = new LocalInfoProvider();

localInfoProvider.on('update', data =>
{
    console.log('Info update: ');
    console.log(data);
});

module.exports.templateTags = [
    ...remoteApi.templateTags
]

module.exports.workspaceActions = [
    ...remoteApi.workspaceActions
];
