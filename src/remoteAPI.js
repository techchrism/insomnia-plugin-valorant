const RiotAuthProvider = require('./info-providers/RiotAuthProvider');

const riotAuthProvider = new RiotAuthProvider();

module.exports.templateTags = [
    {
        name: 'puuid',
        displayName: 'PUUID',
        description: 'Valorant Player UUID',
        async run(context)
        {
            return (await riotAuthProvider.invoke(context))['puuid'];
        }
    },
    {
        name: 'entitlement',
        displayName: 'Riot Entitlement',
        description: 'Valorant Player Entitlement',
        async run(context)
        {
            return (await riotAuthProvider.invoke(context))['entitlement'];
        }
    },
    {
        name: 'token',
        displayName: 'Riot Token',
        description: 'Valorant Player Token',
        async run(context)
        {
            return (await riotAuthProvider.invoke(context))['token'];
        }
    }
];

module.exports.workspaceActions = [
    {
        label: 'Sign out of Riot account',
        icon: 'fa-sign-out',
        async action(context)
        {
            riotAuthProvider.checkStore(context.store);
            await riotAuthProvider.clearAccount();
        }
    },
    {
        label: 'Sign in to Riot account',
        icon: 'fa-sign-in',
        async action(context)
        {
            riotAuthProvider.checkStore(context.store);
            await riotAuthProvider.clearAccount();
            await riotAuthProvider.invoke(context);
        }
    },
];
