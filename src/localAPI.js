const LocalInfoProvider = require('./info-providers/LocalInfoProvider');

const localInfoProvider = new LocalInfoProvider();
window.localInfoProvider = localInfoProvider;

function getLockfileDataElement(name)
{
    if(localInfoProvider.lockFileData === null)
    {
        throw new Error('No lockfile found! Is Valorant running?');
    }
    return localInfoProvider.lockFileData[name];
}

function generateLockfileTag(displayName, property)
{
    return {
        name: 'lockfile' + property,
        displayName: 'Lockfile ' + displayName,
        description: 'Valorant Lockfile ' + displayName,
        async run()
        {
            return getLockfileDataElement(property);
        }
    }
}

module.exports.templateTags = [
    generateLockfileTag('Port', 'port'),
    generateLockfileTag('Password', 'password'),
    generateLockfileTag('Protocol', 'protocol')
];

module.exports.workspaceActions = [
    {
        label: 'Set Region',
        async action(context)
        {
            await localInfoProvider.manuallySetRegion(context);
        }
    }
];
