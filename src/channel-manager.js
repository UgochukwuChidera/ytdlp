import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import ytDlp from 'yt-dlp-exec';
import { getBinDir } from './binary-manager.js';

const DATA_FILE = path.join(os.homedir(), '.local', 'share', 'ytdlp-app', 'channels.json');

let subscriptions = [];

function ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function load() {
    ensureDataDir();
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            subscriptions = JSON.parse(raw);
        } else {
            subscriptions = [];
            save();
        }
    } catch {
        subscriptions = [];
        save();
    }
}

function save() {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
}

load();

function generateId() {
    return crypto.randomUUID();
}

export async function subscribe(url) {
    const existing = subscriptions.find(s => s.url === url);
    if (existing) return existing;

    let channelInfo;
    try {
        channelInfo = await ytDlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
            extractFlat: true,
        });
    } catch {
        channelInfo = {};
    }

    const channel = {
        id: generateId(),
        url,
        name: channelInfo.channel || channelInfo.uploader || channelInfo.title || url,
        avatar: channelInfo.thumbnails?.[0]?.url || undefined,
        subscriberCount: channelInfo.subscriber_count || 0,
        videoCount: channelInfo.playlist_count || channelInfo.channel_follower_count || 0,
        createdAt: Date.now(),
    };

    subscriptions.push(channel);
    save();
    return channel;
}

export function unsubscribe(id) {
    const idx = subscriptions.findIndex(s => s.id === id);
    if (idx === -1) return false;
    subscriptions.splice(idx, 1);
    save();
    return true;
}

export function getSubscriptions() {
    return [...subscriptions];
}

export function getChannel(id) {
    return subscriptions.find(s => s.id === id) || null;
}

export function updateChannel(id, data) {
    const channel = subscriptions.find(s => s.id === id);
    if (!channel) return null;
    const allowed = ['name', 'avatar'];
    for (const key of allowed) {
        if (key in data) {
            channel[key] = data[key];
        }
    }
    save();
    return channel;
}

export async function scrapeChannelVideos(id) {
    const channel = subscriptions.find(s => s.id === id);
    if (!channel) throw new Error('Channel not found');

    const types = ['videos', 'shorts', 'streams'];
    const results = [];

    for (const t of types) {
        const baseUrl = channel.url.replace(/\/?(?:videos|shorts|streams|featured)?\/?$/, '');
        const url = t === 'videos' ? baseUrl + '/videos' : t === 'shorts' ? baseUrl + '/shorts' : baseUrl + '/streams';

        try {
            const data = await ytDlp(url, {
                dumpSingleJson: true,
                flatPlaylist: true,
                noWarnings: true,
                noCallHome: true,
                preferFreeFormats: true,
                youtubeSkipDashManifest: true,
                extractFlat: true,
                ignoreErrors: true,
            });

            const entries = (data.entries || []).map(e => ({
                id: e.id,
                url: e.url || e.webpage_url,
                title: e.title,
                duration: e.duration,
                uploaded: e.upload_date,
                viewCount: e.view_count,
                type: t === 'shorts' ? 'short' : t === 'streams' ? 'stream' : 'video',
            }));
            results.push(...entries);
        } catch {
            // type may not exist for this channel, skip silently
        }
    }

    return results;
}
