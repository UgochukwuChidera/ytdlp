/**
 * @typedef {Object} DownloadJob
 * @property {string} id - Unique job ID
 * @property {string} url - Video/playlist URL
 * @property {string} title - Video title
 * @property {'queued'|'downloading'|'completed'|'failed'} status
 * @property {number} progress - 0-100
 * @property {string} [filename] - Output filename when done
 * @property {string} [error] - Error message if failed
 * @property {number} createdAt - Timestamp
 * @property {DownloadOptions} options
 *
 * @typedef {Object} DownloadOptions
 * @property {string} [format] - Video format (mp4, webm, etc)
 * @property {string} [quality] - Quality preset (best, 1080p, etc)
 * @property {boolean} [audioOnly] - Extract audio only
 * @property {string} [audioFormat] - Audio format (mp3, m4a, etc)
 * @property {string} [outputTemplate] - Custom output template
 * @property {number} [concurrent] - Concurrency for this job (1-5)
 * @property {Object} [extraArgs] - Additional yt-dlp flags
 *
 * @typedef {Object} ChannelSubscription
 * @property {string} id - Unique channel ID
 * @property {string} url - Channel URL
 * @property {string} name - Channel name
 * @property {string} [avatar] - Channel avatar URL
 * @property {number} subscriberCount
 * @property {number} videoCount
 * @property {string} [lastChecked] - ISO date of last check
 * @property {string} [lastVideoDate] - ISO date of newest known video
 * @property {string[]} [scrapeTypes] - Types to scrape (videos, shorts, streams, all)
 * @property {DownloadOptions} [downloadOptions] - Default download options for this channel
 * @property {boolean} [autoDownload] - Auto-download new videos
 * @property {number} createdAt
 *
 * @typedef {Object} BinaryInfo
 * @property {'yt-dlp'|'ffmpeg'|'ffprobe'} name
 * @property {string} path - Full filesystem path
 * @property {string} [version] - Version string
 * @property {boolean} exists - Whether binary exists
 * @property {string} [latestVersion] - Latest available version
 * @property {boolean} [hasUpdate] - Whether update is available
 */

export {};
