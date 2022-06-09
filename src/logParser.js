const fs = require('fs');
const es = require('event-stream');
const path = require('path');

async function parseLog(checker) {
    return new Promise((resolve, reject) => {
        const logPath = path.join(process.env.LOCALAPPDATA, '/VALORANT/Saved/Logs/ShooterGame.log');
        let readStream = fs.createReadStream(logPath, {
            flags: 'r',
            encoding: 'utf8'
        }).pipe(es.split()).pipe(es.through(function write(data) {
            const ret = checker(data);
            if (ret !== false) {
                resolve(ret);
                this.pause();
                readStream.destroy();
            }
        }, () => {
            // Empty resolve at stream end
            resolve();
        }));
    });
}

async function getClientVersion() {
    return await parseLog(line => {
        const match = line.match(/CI server version: (.+)/);
        if (match) {
            return match[1];
        }
        return false;
    });
}

async function getRegion() {
    return await parseLog(line => {
        const match = line.match(/(na|eu|ko|ap)\.a\.pvp\.net/);
        if (match) {
            return match[1];
        }
        return false;
    });
}

module.exports = {parseLog, getClientVersion, getRegion};
