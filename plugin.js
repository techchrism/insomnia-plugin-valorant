const LocalInfoProvider = require('./src/LocalInfoProvider');
const RiotAuthProvider = require('./src/RiotAuthProvider');

const riotAuthProvider = new RiotAuthProvider();
window.riotAuthProvider = riotAuthProvider;
const localInfoProvider = new LocalInfoProvider();

localInfoProvider.on('update', data =>
{
    console.log('Info update: ');
    console.log(data);
});

module.exports.templateTags = [
    {
        name: 'puuid',
        displayName: 'PUUID',
        description: 'Valorant Player UUID',
        async run(context)
        {
            const data = await riotAuthProvider.invoke(context);
            return data['puuid'];
        }
    },
    {
        name: 'entitlement',
        displayName: 'Entitlement',
        description: 'Valorant Player Entitlement',
        async run(context)
        {
            const data = await riotAuthProvider.invoke(context);
            return data['entitlement'];
        }
    },
    {
        name: 'token',
        displayName: 'Token',
        description: 'Valorant Player Token',
        async run(context)
        {
            const data = await riotAuthProvider.invoke(context);
            return data['token'];
        }
    }
]
