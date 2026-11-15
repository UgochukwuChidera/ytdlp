#!/usr/bin/env node
// Local TLS for the app: creates a private CA + a server certificate for
// ytdlp.local/localhost under ~/.local/share/ytdlp-app/tls. The server
// auto-detects those files and starts listening on 443.
//
//   npm run tls:install   -> node scripts/tls.js install   (no sudo)
//   npm run tls:trust     -> prints the one sudo command to trust the CA system-wide
//   npm run tls:nss       -> imports the CA into Firefox/Chromium cert DBs (close browsers first)
//   npm run tls:status
//   npm run tls:remove
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TLS_DIR = process.env.TLS_DIR || path.join(userHome(), '.local', 'share', 'ytdlp-app', 'tls');
const CA_KEY = path.join(TLS_DIR, 'ca.key');
const CA_CRT = path.join(TLS_DIR, 'ca.crt');
const SERVER_KEY = path.join(TLS_DIR, 'server.key');
const SERVER_CRT = path.join(TLS_DIR, 'server.crt');
const CA_NAME = 'ytdlp-app local CA';

const mode = (process.argv[2] || '').replace(/^--/, '');
// Under sudo, os.homedir() is /root — resolve the invoking user's real home
// so trust/remove modes can still find the certs.
function userHome() {
    const sudoUser = process.env.SUDO_USER;
    if (!sudoUser) return os.homedir();
    try {
        const passwd = fs.readFileSync('/etc/passwd', 'utf8');
        const line = passwd.split('\n').find((l) => l.startsWith(`${sudoUser}:`));
        if (line) return line.split(':')[5] || os.homedir();
    } catch { /* fall through */ }
    return path.join('/home', sudoUser);
}

function run(cmd, args) {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function genCerts() {
    fs.mkdirSync(TLS_DIR, { recursive: true });
    const ext = path.join(TLS_DIR, 'ext.cnf');
    try {
        // Private CA (10y) — the browser-facing trust anchor.
        run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '3650',
            '-nodes', '-keyout', CA_KEY, '-out', CA_CRT,
            '-subj', `/CN=${CA_NAME}`,
            '-addext', 'basicConstraints=critical,CA:TRUE',
            '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
        // Server cert (SANs cover the alias, localhost and loopback IPs).
        const csr = path.join(TLS_DIR, 'server.csr');
        run('openssl', ['req', '-newkey', 'rsa:2048', '-sha256', '-nodes',
            '-keyout', SERVER_KEY, '-out', csr, '-subj', '/CN=ytdlp.local']);
        fs.writeFileSync(ext, `\
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:ytdlp.local,DNS:localhost,IP:127.0.0.1,IP:::1
`, 'utf8');
        run('openssl', ['x509', '-req', '-in', csr, '-CA', CA_CRT, '-CAkey', CA_KEY,
            '-CAcreateserial', '-days', '825', '-sha256', '-extfile', ext, '-out', SERVER_CRT]);
        fs.unlinkSync(csr);
        fs.unlinkSync(ext);
        fs.chmodSync(CA_KEY, 0o600);
        fs.chmodSync(SERVER_KEY, 0o600);
        run('openssl', ['verify', '-CAfile', CA_CRT, SERVER_CRT]);
    } catch (err) {
        console.error(`Certificate generation failed: ${err.message}`);
        process.exit(1);
    }
}

function nssProfiles() {
    const dirs = [];
    const seen = new Set();
    const scan = (base) => {
        if (!fs.existsSync(base)) return;
        for (const name of fs.readdirSync(base)) {
            const dir = path.join(base, name);
            if (fs.existsSync(path.join(dir, 'cert9.db')) && !seen.has(dir)) {
                seen.add(dir);
                dirs.push(dir);
            }
        }
    };
    const home = os.homedir();
    // Firefox (classic ~/.mozilla and the newer ~/.config/mozilla layout),
    // Firefox flatpak, Librewolf/Zen, and the shared Chromium ~/.pki store.
    scan(path.join(home, '.mozilla', 'firefox'));
    scan(path.join(home, '.config', 'mozilla', 'firefox'));
    scan(path.join(home, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox'));
    scan(path.join(home, '.librewolf'));
    scan(path.join(home, '.zen'));
    const pki = path.join(home, '.pki', 'nssdb');
    if (fs.existsSync(path.join(pki, 'cert9.db'))) dirs.push(pki);
    return dirs;
}

function nssImport() {
    let certutil;
    try { execFileSync('which', ['certutil']); } catch {
        console.error('certutil (libnss3-tools / nss) not found — import manually:');
        console.log(`  Firefox: Settings -> Privacy & Security -> Certificates -> View Certificates -> Authorities -> Import -> ${CA_CRT}`);
        process.exit(1);
    }
    const profiles = nssProfiles();
    if (profiles.length === 0) {
        console.log('No NSS certificate databases found.');
        return;
    }
    for (const dir of profiles) {
        try {
            run('certutil', ['-A', '-n', CA_NAME, '-t', 'CT,C,C', '-i', CA_CRT, '-d', `sql:${dir}`]);
            console.log(`Imported CA into ${dir}`);
        } catch (err) {
            console.error(`Failed for ${dir}: ${err.message} (is the browser running? close it and retry)`);
        }
    }
}

function nssRemove() {
    for (const dir of nssProfiles()) {
        try {
            run('certutil', ['-D', '-n', CA_NAME, '-d', `sql:${dir}`]);
            console.log(`Removed CA from ${dir}`);
        } catch { /* not present */ }
    }
}

function trustCommand() {
    const isRoot = process.getuid && process.getuid() === 0;
    if (isRoot) {
        execFileSync('cp', [CA_CRT, '/etc/ca-certificates/trust-source/anchors/ytdlp-app-local-ca.crt']);
        run('update-ca-trust');
        console.log('CA trusted system-wide.');
        return;
    }
    let osId = '';
    try {
        const rel = fs.readFileSync('/etc/os-release', 'utf8');
        osId = (rel.match(/^ID=(.*)$/m) || [])[1] || '';
    } catch { /* ignore */ }
    if (osId.includes('debian') || osId.includes('ubuntu')) {
        console.log(`sudo cp ${CA_CRT} /usr/local/share/ca-certificates/ytdlp-app-local-ca.crt && sudo update-ca-certificates`);
    } else {
        // Arch-family (incl. CachyOS) and Fedora-style p11-kit layouts.
        console.log(`sudo cp ${CA_CRT} /etc/ca-certificates/trust-source/anchors/ytdlp-app-local-ca.crt && sudo update-ca-trust`);
        if (osId.includes('fedora')) console.log('(Fedora: sudo cp to /etc/pki/ca-trust/source/anchors/ && sudo update-ca-trust)');
    }
    console.log('Then close and reopen your browsers.');
}

if (mode === 'install') {
    if (fs.existsSync(SERVER_CRT) && fs.existsSync(CA_CRT)) {
        try {
            run('openssl', ['verify', '-CAfile', CA_CRT, SERVER_CRT]);
            console.log(`Certificates already present in ${TLS_DIR} — reusing them.`);
            console.log('(Delete the directory or run node scripts/tls.js remove to regenerate;');
            console.log(' regenerating rotates the CA and invalidates trust!)');
        } catch {
            console.log('Existing certs are broken — regenerating.');
            genCerts();
        }
    } else {
        genCerts();
    }
    console.log('The server picks them up on next restart (listens on 443).');
    console.log('\nNext steps:');
    console.log('  1) Trust the CA system-wide — run the command below:');
    trustCommand();
    console.log('  2) Import the CA into Firefox/Chrome (close them first):');
    console.log('       npm run tls:nss');
} else if (mode === 'trust') {
    if (!fs.existsSync(CA_CRT)) { console.error('No CA yet — run npm run tls:install first.'); process.exit(1); }
    trustCommand();
} else if (mode === 'nss') {
    if (!fs.existsSync(CA_CRT)) { console.error('No CA yet — run npm run tls:install first.'); process.exit(1); }
    nssImport();
} else if (mode === 'status') {
    if (!fs.existsSync(SERVER_CRT)) {
        console.log('TLS: not configured (npm run tls:install)');
    } else {
        const out = run('openssl', ['x509', '-in', SERVER_CRT, '-noout', '-subject', '-enddate']);
        console.log(`TLS: configured\n${out.trim()}`);
    }
} else if (mode === 'remove') {
    nssRemove();
    if (fs.existsSync(TLS_DIR)) fs.rmSync(TLS_DIR, { recursive: true, force: true });
    console.log(`Removed ${TLS_DIR}. Restart the service to drop port 443.`);
} else {
    console.log('Usage: node scripts/tls.js install|trust|nss|status|remove');
    process.exit(1);
}
