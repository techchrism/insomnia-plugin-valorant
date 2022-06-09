# Valorant Insomnia Plugin 
Adds template tags to Insomnia with Valorant data.

To use the tags `puuid`, `entitlement`, and `token`, you must sign in to your Riot account
from the dropdown menu on the top left, above Cookies.
If you select "Stay signed in", the entitlement and token will be automatically regenerated when they expire.

## Features 
 - Automatic regeneration of entitlement and token
 - Automatic population of live local data such as current game id and lockfile port/password

![Screenshot showing lockfile tags](https://user-images.githubusercontent.com/26680599/172743896-994eddf9-f8c4-4055-8f5b-6b7ac53dbda6.png)
![Screenshot with sign in screen](https://user-images.githubusercontent.com/26680599/172743816-37c5fee2-3ce8-46b8-909e-56ea96d8bf65.png)

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
