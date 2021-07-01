# Valorant Insomnia Plugin 
Adds template tags to Insomnia with Valorant data.

To populate the data, the plugin will ask you to sign in to your Riot account to use the tags `puuid`, `entitlement`, and `token`.
If you select "Stay signed in", the entitlement and token will be automatically regenerated when they expire.

![Screenshot](https://i.imgur.com/0A9Oi31.png)
![Screenshot 2](https://i.imgur.com/nLl46Np.png)

Use `crtl+space` to insert tags. For more info, see [https://support.insomnia.rest/article/171-template-tags](https://support.insomnia.rest/article/171-template-tags)

## Installation
Go to Application -> Preferences -> Plugins and add the plugin `insomnia-plugin-valorant`

## Added Tags

### PUUID
The player's unique id. This requires a Riot login.

### Riot Token
A token used for requests on behalf of the player. This expires every hour but if "Stay signed in" is checked, it will automatically regenerate.

### Riot Entitlement
A token used for requests on behalf of the player. This expires every hour but if "Stay signed in" is checked, it will automatically regenerate.

### Lockfile Port
The port for the local API specified in the lockfile.

### Lockfile Password
The password for the local API specified in the lockfile.

### Lockfile Protocol
The protocol for the local API specified in the lockfile.

### Region
The region of the game installation.

### Client Version
The version of the game installation or, if one cannot be found, the latest version.

### Client Platform
A string identifying the platform of the client.

### Pregame Match ID
The ID of the current match. Only valid during the pre-game phase.

### Coregame Match ID
The ID of the current match. Only valid after the pre-game phase.

### Party ID
The ID of the party the player is currently in.

## Debugging
When reporting a bug, open the dev console (`crtl+alt+i`) and include the log in your report.
