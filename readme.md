# Valorant Insomnia Plugin 
Adds template tags to Insomnia with Valorant data.

## Features 
 - Automatic regeneration of entitlement and token
 - Automatic population of live local data such as current game id and lockfile port/password
 - Dynamically created XMPP WebSockets for logging XMPP traffic

![Screenshot showing XMPP MITM WebSocket](https://github.com/techchrism/insomnia-plugin-valorant/assets/26680599/3ce9aac0-ba35-4417-ad11-51e357f087a0)
![Screenshot showing lockfile tags](https://user-images.githubusercontent.com/26680599/172743896-994eddf9-f8c4-4055-8f5b-6b7ac53dbda6.png)
![Screenshot with sign in screen](https://user-images.githubusercontent.com/26680599/172743816-37c5fee2-3ce8-46b8-909e-56ea96d8bf65.png)

Use `crtl+space` to insert tags. For more info, see [https://support.insomnia.rest/article/171-template-tags](https://support.insomnia.rest/article/171-template-tags)

## Installation
Go to Application -> Preferences -> Plugins and add the plugin `insomnia-plugin-valorant`

## Added Tags

| Tag Name              | Tag ID                  | Description                                           |
|-----------------------|-------------------------|-------------------------------------------------------|
| Client Platform       | `client_platform`       | The client platform, a base64-encoded JSON string     |
| Client Version        | `client_version`        | The client version                                    |
| Lockfile Port         | `lockfile_port`         | The port specified in the lockfile                    |
| Lockfile Password     | `lockfile_password`     | The password specified in the lockfile                |
| PUUID                 | `puuid`                 | The player's unique id                                |
| Region                | `valorant_region`       | The region of the player's account                    |
| Shard                 | `valorant_shard`        | The shard of the player's account                     |
| Token                 | `valorant_token`        | The Riot auth token                                   |
| Entitlement           | `valorant_entitlement`  | The Riot entitlement token                            |
| ID Token              | `valorant_id_token`     | The Riot ID token                                     |
| PAS Token             | `valorant_pas_token`    | The Riot PAS token                                    |
| Pre-Game Match ID     | `pregame_match_id`      | The match id of the current pre-game lobby            |
| Current Game Match ID | `current_game_match_id` | The match id of the current game (after agent select) |
| Party ID              | `party_id`              | The party id of the current party                     |
| Riot XMPP             | `riot_xmpp`             | The Riot XMPP WebSocket URL. Read more below.         |
| Riot XMPP MITM        | `riot_xmpp_mitm`        | The Riot XMPP MITM WebSocket URL. Read more below.    |


### XMPP WebSocket

The XMPP WebSocket URL is a url for a localhost WebSocket server which is created on the fly by the plugin.

Connecting requires the Riot auth and entitlement headers as well as a `X-Riot-PAS-JWT` header with the value of the PAS JWT (can be obtained with the `{% valorant_pas_token  %}` template tag)

Upon connecting to the server, the plugin creates a new XMPP connection to the Riot XMPP server and forwards the messages to the WebSocket.

The WebSocket url can have the following url suffixes (if there is no url suffix, `raw` is used):

|                |                                                                                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `raw`          | The raw XMPP data                                                                                                                                            |
| `raw-buffered` | Sometimes messages are sent that don't include a full valid XML tag. This mode buffers messages until the resulting buffer is valid XML.                     |
| `json`         | Similar to `raw-buffered` but converts the XML to JSON. This is useful for Insomnia auto-formatting. Note that when sending data, it must be in JSON format. |

### XMPP MITM WebSocket

Like the regular XMPP WebSocket, the XMPP MITM WebSocket (man in the middle) WebSocket URL is a url for a localhost WebSocket server which is created on the fly by the plugin.
However, unlike the regular XMPP WebSocket, no special headers are required to connect.
The XMPP MITM WebSocket sits in between the Riot client and the Riot XMPP server and shows the data sent between them and can send custom messages to either one.

Upon connecting to the server, the plugin starts up the Riot Client with settings to use an http proxy so it can intercept the XMPP connection urls and replace them with its own server.
The resulting connection is then forwarded to the WebSocket.

The XMPP MITM WebSocket supports the same url suffixes as the regular XMPP WebSocket.

When sending data to the WebSocket, it must start with "to-server" or "to-client" followed by a newline.

## Debugging
When reporting a bug, open the dev console (`crtl+alt+i`) and include the log in your report.

## Dev Setup
- clone the repo
- `npm install`
- `npm run build` or `npm run watch`
- if on Windows, run `npm run link-windows` to set up a junction to the default Insomnia plugins directory
