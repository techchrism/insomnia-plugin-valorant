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
    generateLockfileTag('Protocol', 'protocol'),
    {
        name: 'valorantregion',
        displayName: 'Region',
        description: 'Valorant account region',
        async run(context)
        {
            return await localInfoProvider.getRegion(context);
        }
    },
    {
        name: 'clientversion',
        displayName: 'Client Version',
        description: 'Valorant client version',
        async run()
        {
             return await localInfoProvider.getClientVersion();
        }
    },
    {
        name: 'clientplatform',
        displayName: 'Client Platform',
        description: 'Valorant client platform',
        async run()
        {
            return 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
        }
    }
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
