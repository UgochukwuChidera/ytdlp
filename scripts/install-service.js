#!/usr/bin/env node
// Installs/uninstalls/status for the ytdlp-app background service.
// Linux: systemd user unit (starts at login, stops at logout).
// macOS: launchd user agent.
// Windows: prints Task Scheduler instructions.
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const PORT = process.env.PORT || '4444';

const arg = process.argv[2] || '';
const mode = arg.startsWith('--') ? arg.slice(2) : arg;
if (!['install', 'uninstall', 'status'].includes(mode)) {
    console.log(`Usage: node scripts/install-service.js [--install|--uninstall|--status]`);
    process.exit(1);
}

function linuxUnitPath() {
    return path.join(os.homedir(), '.config', 'systemd', 'user', 'ytdlp-app.service');
}

function macPlistPath() {
    return path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.ytdlp-app.plist');
}

function run(cmd) {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function runOrWarn(cmd) {
    try {
        return run(cmd);
    } catch (err) {
        console.warn(`(command failed: ${cmd})`);
        console.warn(String(err.stderr || err.message).trim());
        return null;
    }
}

// "Open file/folder" uses xdg-open with a gio fallback (both on PATH).
// systemd user units start without DISPLAY, so the server discovers the
// session env itself — but at least one opener binary must exist.
function checkOpenersLinux() {
    const has = (cmd) => {
        try {
            run(`command -v ${cmd} >/dev/null 2>&1`);
            return true;
        } catch { return false; }
    };
    const ok = has('xdg-open') || has('gio');
    if (!ok) {
        console.warn('⚠  Neither xdg-open nor gio was found on PATH.');
        console.warn('   The "Open file/folder" buttons need one of them:');
        console.warn('     Debian/Ubuntu:  sudo apt install xdg-utils');
        console.warn('     Arch:           sudo pacman -S xdg-utils');
        console.warn('     Fedora:         sudo dnf install xdg-user-dirs xdg-utils');
        console.warn('     openSUSE:       sudo zypper install xdg-utils');
        console.warn('   (gio from glib2 is the fallback — any one is enough.)');
    } else {
        console.log(`Opener check: ${has('xdg-open') ? 'xdg-open' : 'gio'} found.`);
    }
    return ok;
}

function installLinux() {
    checkOpenersLinux();
    const unitDir = path.dirname(linuxUnitPath());
    fs.mkdirSync(unitDir, { recursive: true });
    const unit = `\
[Unit]
Description=YT-DLP Web Interface
After=network-online.target

[Service]
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${NODE_BIN} server.js
Restart=on-failure
RestartSec=2
StartLimitIntervalSec=0
# 80 so the bare http://ytdlp.local works, 4444 kept for existing bookmarks.
# Binding 80 as a regular user needs net.ipv4.ip_unprivileged_port_start
# lowered once (see README); until then the server just skips port 80.
Environment=PORTS=80,${PORT}
NoNewPrivileges=true
MemoryMax=512M

[Install]
WantedBy=default.target
`;
    fs.writeFileSync(linuxUnitPath(), unit, 'utf8');
    console.log(`Wrote ${linuxUnitPath()}`);
    runOrWarn('systemctl --user daemon-reload');
    const enabled = runOrWarn('systemctl --user enable --now ytdlp-app');
    if (enabled !== null) console.log('Service enabled and started (login scope).');
}

function installMac() {
    const plistDir = path.dirname(macPlistPath());
    fs.mkdirSync(plistDir, { recursive: true });
    const plist = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ytdlp-app</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${path.join(PROJECT_ROOT, 'server.js')}</string>
  </array>
  <key>WorkingDirectory</key><string>${PROJECT_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PORT</key><string>${PORT}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${path.join(PROJECT_ROOT, 'server.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(PROJECT_ROOT, 'server.log')}</string>
</dict>
</plist>
`;
    fs.writeFileSync(macPlistPath(), plist, 'utf8');
    console.log(`Wrote ${macPlistPath()}`);
    runOrWarn(`launchctl unload ${macPlistPath()}`);
    runOrWarn(`launchctl load ${macPlistPath()}`);
    console.log('Service loaded (runs at login).');
}

function installWindows() {
    console.log(`Windows setup (run once in an elevated PowerShell):\n`);
    console.log(`  schtasks /create /tn "YT-DLP Web Interface" /sc onlogon /tr "\\"${NODE_BIN}\\" \\"${path.join(PROJECT_ROOT, 'server.js')}\\"" /f`);
    console.log(`\nTo start it now:  schtasks /run /tn "YT-DLP Web Interface"`);
    console.log(`To remove it:     schtasks /delete /tn "YT-DLP Web Interface" /f`);
    console.log(`\nOr simply run "npm start" from ${PROJECT_ROOT} whenever you want the app.`);
}

function uninstallLinux() {
    runOrWarn('systemctl --user disable --now ytdlp-app');
    if (fs.existsSync(linuxUnitPath())) {
        fs.unlinkSync(linuxUnitPath());
        console.log(`Removed ${linuxUnitPath()}`);
    }
    runOrWarn('systemctl --user daemon-reload');
    console.log('Service uninstalled.');
}

function uninstallMac() {
    if (fs.existsSync(macPlistPath())) {
        runOrWarn(`launchctl unload ${macPlistPath()}`);
        fs.unlinkSync(macPlistPath());
        console.log(`Removed ${macPlistPath()}`);
    }
    console.log('Service uninstalled.');
}

function uninstallWindows() {
    console.log('Windows: run  schtasks /delete /tn "YT-DLP Web Interface" /f  in an elevated shell.');
}

function statusLinux() {
    const active = runOrWarn('systemctl --user is-active ytdlp-app');
    console.log(active === 'active' ? '● running' : '○ not running');
    if (fs.existsSync(linuxUnitPath())) console.log(`unit: ${linuxUnitPath()}`);
    else console.log('unit: not installed');
    const port = runOrWarn(`curl -s -o /dev/null -w '%{http_code}' http://localhost:${PORT}/api/status`);
    if (port === '200') console.log(`http://localhost:${PORT} — responding`);
    const low = runOrWarn(`curl -sLk -o /dev/null -w '%{http_code}' http://localhost/api/status`);
    if (low === '200') console.log('http://ytdlp.local (port 80) — responding');
    const tls = runOrWarn(`curl -sk -o /dev/null -w '%{http_code}' https://localhost/api/status`);
    if (tls === '200') console.log('https://ytdlp.local (TLS) — responding');
}

function statusMac() {
    const out = runOrWarn(`launchctl list | grep ytdlp-app`);
    console.log(out ? `● loaded: ${out}` : '○ not loaded');
    if (fs.existsSync(macPlistPath())) console.log(`plist: ${macPlistPath()}`);
    else console.log('plist: not installed');
}

switch (mode) {
    case 'install':
        if (process.platform === 'linux') installLinux();
        else if (process.platform === 'darwin') installMac();
        else installWindows();
        break;
    case 'uninstall':
        if (process.platform === 'linux') uninstallLinux();
        else if (process.platform === 'darwin') uninstallMac();
        else uninstallWindows();
        break;
    case 'status':
        if (process.platform === 'linux') statusLinux();
        else if (process.platform === 'darwin') statusMac();
        else console.log('Windows: check Task Scheduler for "YT-DLP Web Interface".');
        break;
}
