#!/usr/bin/env node
// Manages the local hostname aliases for the app (ytdlp.local)
// via a marked block in /etc/hosts. install/remove need sudo (they edit
// /etc/hosts); check does not.
//
//   npm run alias:install   -> sudo node scripts/alias.js install
//   npm run alias:remove    -> sudo node scripts/alias.js remove
//   npm run alias:check     -> node scripts/alias.js check
import dns from 'dns';
import fs from 'fs';

const PORT = process.env.PORT || '4444';
const NAMES = ['ytdlp.local'];

const BEGIN = '# >>> ytdlp-app >>>';
const END = '# <<< ytdlp-app <<<';
const HOSTS_LINE = `127.0.0.1 ${NAMES.join(' ')}`;
const HOSTS_FILE = '/etc/hosts';

const mode = (process.argv[2] || '').replace(/^--/, '');
if (!['install', 'remove', 'check'].includes(mode)) {
    console.log('Usage: node scripts/alias.js [install|remove|check]');
    process.exit(1);
}

function readHosts() {
    return fs.readFileSync(HOSTS_FILE, 'utf8');
}

function buildHosts(content, block) {
    const beginIdx = content.indexOf(BEGIN);
    const endIdx = content.indexOf(END);
    let head = content;
    let tail = '';
    if (beginIdx !== -1 && endIdx !== -1) {
        head = content.slice(0, beginIdx);
        tail = content.slice(endIdx + END.length);
    }
    if (!head.endsWith('\n')) head += '\n';
    return block === null
        ? `${head.trimEnd()}\n${tail.trimStart()}`
        : `${head}${BEGIN}\n${HOSTS_LINE}\n${END}${tail}`;
}

if (mode === 'install') {
    const content = readHosts();
    if (content.includes(BEGIN)) {
        console.log('Alias block already present in /etc/hosts.');
        process.exit(0);
    }
    try {
        fs.writeFileSync(HOSTS_FILE, buildHosts(content, true), 'utf8');
    } catch (err) {
        if (err.code === 'EACCES') {
            console.error(`Permission denied editing ${HOSTS_FILE}.\nRun it with sudo:  sudo node scripts/alias.js install  (or: npm run alias:install)`);
            process.exit(1);
        }
        throw err;
    }
    console.log(`Added to ${HOSTS_FILE}: ${HOSTS_LINE}`);
    console.log(`Open: http://${NAMES[0]} (port 80 via the background service, or :${PORT} for manual runs)`);
} else if (mode === 'remove') {
    const content = readHosts();
    if (!content.includes(BEGIN)) {
        console.log('No alias block found in /etc/hosts.');
        process.exit(0);
    }
    try {
        fs.writeFileSync(HOSTS_FILE, buildHosts(content, null), 'utf8');
    } catch (err) {
        if (err.code === 'EACCES') {
            console.error(`Permission denied editing ${HOSTS_FILE}.\nRun it with sudo:  sudo node scripts/alias.js remove  (or: npm run alias:remove)`);
            process.exit(1);
        }
        throw err;
    }
    console.log(`Removed the ytdlp-app block from ${HOSTS_FILE}.`);
} else if (mode === 'check') {
    (async () => {
        let resolved = 0;
        for (const name of NAMES) {
            try {
                const { address } = await new Promise((resolve, reject) =>
                    dns.lookup(name, (err, address) => err ? reject(err) : resolve({ address })));
                console.log(`${name} -> ${address}`);
                resolved++;
            } catch {
                console.log(`${name} -> NOT RESOLVED (run "npm run alias:install")`);
            }
        }
        console.log('');
        if (resolved === NAMES.length) {
            console.log(`All aliases resolve. App URLs:`);
            console.log(`  http://${NAMES[0]}            (via the background service, port 80)`);
            console.log(`  http://${NAMES[0]}:${PORT}   (manual npm start / bookmark)`);
            console.log(`  http://localhost:${PORT}`);
        } else {
            console.log('Some aliases are missing. Run: npm run alias:install');
            process.exit(1);
        }
    })();
}
