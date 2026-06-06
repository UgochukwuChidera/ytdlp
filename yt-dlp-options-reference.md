# yt-dlp Comprehensive Options Reference for Node.js Wrapper

> **Source:** https://github.com/yt-dlp/yt-dlp | **Latest stable:** `2026.03.17` | **CLI:** `yt-dlp [OPTIONS] [--] URL [URL...]`

---

## Table of Contents

1. [Version & Update Checking APIs](#1-version--update-checking-apis)
2. [Complete CLI Flag Reference by Category](#2-complete-cli-flag-reference-by-category)
3. [Format Selection (`-f`)](#3-format-selection--f)
4. [Listing Available Formats](#4-listing-available-formats)
5. [Channel/Playlist Options](#5-channelplaylist-options)
6. [Output Templates (`-o`)](#6-output-templates--o)
7. [ffmpeg Version Checking](#7-ffmpeg-version-checking)
8. [Configuration Files](#8-configuration-files)

---

## 1. Version & Update Checking APIs

### yt-dlp Latest Release (GitHub API)

```
GET https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest
```

**Key fields from response:**

| Field | Description |
|-------|-------------|
| `tag_name` | Version tag, e.g. `2026.03.17` |
| `name` | Release name, e.g. `yt-dlp 2026.03.17` |
| `published_at` | ISO date published |
| `assets[].name` | Binary filenames (yt-dlp, yt-dlp.exe, yt-dlp_macos, etc.) |
| `assets[].browser_download_url` | Direct download URL |
| `assets[].size` | File size in bytes |

**Example Node.js fetch:**

```js
const resp = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
const data = await resp.json();
const version = data.tag_name; // "2026.03.17"
const linuxUrl = data.assets.find(a => a.name === 'yt-dlp').browser_download_url;
```

### yt-dlp Update Channels

Three channels exist: `stable` (default), `nightly`, `master`.

| Channel | Repository | Description |
|---------|-----------|-------------|
| stable | yt-dlp/yt-dlp | Monthly releases (default) |
| nightly | yt-dlp/yt-dlp-nightly-builds | Daily snapshots (recommended) |
| master | yt-dlp/yt-dlp-master-builds | Per-commit canary releases |

**CLI update commands:**
```bash
yt-dlp -U                          # Update to latest on current channel
yt-dlp --update-to nightly         # Switch to nightly channel
yt-dlp --update-to stable@2026.03.17  # Specific version
```

---

## 2. Complete CLI Flag Reference by Category

### 2.1 General Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--help` | `-h` | - | Print help text and exit |
| `--version` | - | - | Print program version and exit |
| `--update` | `-U` | - | Update to latest version |
| `--no-update` | - | - | Do not check for updates (default) |
| `--update-to` | - | `[CHANNEL]@[TAG]` | Upgrade/downgrade to specific version |
| `--ignore-errors` | `-i` | - | Ignore download/post-processing errors |
| `--abort-on-error` | - | - | Abort on error (alias: `--no-ignore-errors`) |
| `--list-extractors` | - | - | List all supported extractors |
| `--extractor-descriptions` | - | - | Output extractor descriptions |
| `--use-extractors` | `--ies` | `NAMES` | Extractor names to use (comma-separated, regex) |
| `--default-search` | - | `PREFIX` | Prefix for unqualified URLs (e.g. `gvsearch2:python`) |
| `--ignore-config` | `--no-config` | - | Don't load config files |
| `--config-locations` | - | `PATH` | Config file location (can be used multiple times) |
| `--flat-playlist` | - | - | Do not extract playlist entries fully |
| `--live-from-start` | - | - | Download livestreams from start (experimental) |
| `--wait-for-video` | - | `MIN[-MAX]` | Wait for scheduled streams (seconds) |
| `--mark-watched` | - | - | Mark videos watched |
| `--color` | - | `[STREAM:]POLICY` | Color policy (always/auto/never/no_color) |
| `--compat-options` | - | `OPTS` | youtube-dl compatibility options |
| `--alias` | - | `ALIASES OPTIONS` | Create option aliases |
| `--preset-alias` | `-t` | `PRESET` | Apply preset (mp3, aac, mp4, mkv, sleep) |
| `--plugin-dirs` | - | `DIR` | Additional plugin directory |
| `--js-runtimes` | - | `RUNTIME[:PATH]` | JS runtime to enable (deno/node/quickjs/bun) |
| `--remote-components` | - | `COMPONENT` | Allow fetching remote components |

### 2.2 Network Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--proxy` | - | `URL` | HTTP/HTTPS/SOCKS proxy |
| `--socket-timeout` | - | `SECONDS` | Socket timeout |
| `--source-address` | - | `IP` | Client IP to bind to |
| `--impersonate` | - | `CLIENT[:OS]` | Impersonate browser (e.g. chrome, chrome-110) |
| `--list-impersonate-targets` | - | - | List impersonation targets |
| `--force-ipv4` | `-4` | - | Force IPv4 |
| `--force-ipv6` | `-6` | - | Force IPv6 |
| `--enable-file-urls` | - | - | Enable file:// URLs (disabled by default) |

### 2.3 Geo-restriction

| Flag | Arg | Description |
|------|-----|-------------|
| `--geo-verification-proxy` | `URL` | Proxy for geo-verification |
| `--xff` | `VALUE` | Fake X-Forwarded-For (default/never/CIDR/country code) |

### 2.4 Video Selection

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--playlist-items` | `-I` | `ITEM_SPEC` | Playlist items to download (`[START]:[STOP][:STEP]`) |
| `--min-filesize` | - | `SIZE` | Abort if smaller than SIZE (e.g. 50k, 44.6M) |
| `--max-filesize` | - | `SIZE` | Abort if larger than SIZE |
| `--date` | - | `DATE` | Videos uploaded on this date (YYYYMMDD or relative) |
| `--datebefore` | - | `DATE` | Videos uploaded on or before date |
| `--dateafter` | - | `DATE` | Videos uploaded on or after date |
| `--match-filters` | - | `FILTER` | Generic video filter (output template fields) |
| `--break-match-filters` | - | `FILTER` | Same as --match-filters but stops downloads |
| `--no-playlist` | - | - | Download only the video, not playlist |
| `--yes-playlist` | - | - | Download playlist if URL refers to both |
| `--age-limit` | - | `YEARS` | Age-restrict videos |
| `--download-archive` | - | `FILE` | Record downloaded video IDs |
| `--max-downloads` | - | `NUMBER` | Abort after N downloads |
| `--break-on-existing` | - | - | Stop when encountering archived file |
| `--break-per-input` | - | - | Reset break options per input URL |
| `--skip-playlist-after-errors` | - | `N` | Skip playlist after N failures |

### 2.5 Download Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--concurrent-fragments` | `-N` | `N` | Concurrent fragment downloads (default: 1) |
| `--limit-rate` | `-r` | `RATE` | Max download rate (e.g. 50K, 4.2M) |
| `--throttled-rate` | - | `RATE` | Rate below which throttling assumed |
| `--retries` | `-R` | `RETRIES` | Download retries (default: 10, or "infinite") |
| `--file-access-retries` | - | `RETRIES` | File access retries (default: 3) |
| `--fragment-retries` | - | `RETRIES` | Fragment retries (default: 10) |
| `--retry-sleep` | - | `[TYPE:]EXPR` | Sleep between retries (number/linear/exp) |
| `--skip-unavailable-fragments` | - | - | Skip unavailable fragments (default) |
| `--abort-on-unavailable-fragments` | - | - | Abort on unavailable fragment |
| `--keep-fragments` | - | - | Keep fragments after download |
| `--buffer-size` | - | `SIZE` | Download buffer size (default: 1024) |
| `--resize-buffer` | - | - | Auto-resize buffer (default) |
| `--http-chunk-size` | - | `SIZE` | Chunk size for HTTP downloading (experimental) |
| `--playlist-random` | - | - | Random playlist order |
| `--lazy-playlist` | - | - | Process entries as received |
| `--hls-use-mpegts` | - | - | Use mpegts container for HLS |
| `--download-sections` | - | `REGEX` | Download matching chapters (prefix `*` for time-range) |
| `--downloader` | - | `[PROTO:]NAME` | External downloader (native/aria2c/axel/curl/ffmpeg/httpie/wget) |
| `--downloader-args` | - | `NAME:ARGS` | Arguments to external downloader |

### 2.6 Filesystem Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--batch-file` | `-a` | `FILE` | File containing URLs to download |
| `--paths` | `-P` | `[TYPES:]PATH` | Download paths (home/temp + all output types) |
| `--output` | `-o` | `[TYPES:]TEMPLATE` | Output filename template |
| `--output-na-placeholder` | - | `TEXT` | Placeholder for unavailable fields (default: "NA") |
| `--restrict-filenames` | - | - | ASCII-only filenames, no spaces/& |
| `--windows-filenames` | - | - | Windows-compatible filenames |
| `--trim-filenames` | - | `LENGTH` | Limit filename length |
| `--no-overwrites` | `-w` | - | Don't overwrite files |
| `--force-overwrites` | - | - | Overwrite all files |
| `--continue` | `-c` | - | Resume partial downloads (default) |
| `--part` | - | - | Use .part files (default) |
| `--mtime` | - | - | Use Last-modified header for file time |
| `--write-description` | - | - | Write .description file |
| `--write-info-json` | - | - | Write video metadata to .info.json |
| `--write-playlist-metafiles` | - | - | Write playlist metadata files |
| `--clean-info-json` | - | - | Remove internal metadata from infojson (default) |
| `--write-comments` | - | - | Retrieve video comments |
| `--load-info-json` | - | `FILE` | Load video info from JSON |
| `--cookies` | - | `FILE` | Cookies file (Netscape format) |
| `--cookies-from-browser` | - | `BROWSER[+KEYRING][:PROFILE][::CONTAINER]` | Load cookies from browser |
| `--cache-dir` | - | `DIR` | Cache directory |
| `--rm-cache-dir` | - | - | Delete cache |

### 2.7 Thumbnail Options

| Flag | Arg | Description |
|------|-----|-------------|
| `--write-thumbnail` | - | Write thumbnail to disk |
| `--write-all-thumbnails` | - | Write all thumbnail formats |
| `--list-thumbnails` | - | List available thumbnails |

### 2.8 Internet Shortcut Options

| Flag | Description |
|------|-------------|
| `--write-link` | Platform-appropriate internet shortcut (.url/.webloc/.desktop) |
| `--write-url-link` | Windows .url shortcut |
| `--write-webloc-link` | macOS .webloc shortcut |
| `--write-desktop-link` | Linux .desktop shortcut |

### 2.9 Verbosity & Simulation Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--quiet` | `-q` | - | Quiet mode |
| `--no-warnings` | - | - | Ignore warnings |
| `--simulate` | `-s` | - | Don't download anything |
| `--ignore-no-formats-error` | - | - | Ignore "No video formats" error |
| `--skip-download` | - | - | Don't download video, write related files |
| `--print` | `-O` | `[WHEN:]TEMPLATE` | Print field/template to screen |
| `--print-to-file` | - | `[WHEN:]TEMPLATE FILE` | Append template to file |
| `--dump-json` | `-j` | - | Print JSON info for each video |
| `--dump-single-json` | `-J` | - | Print JSON for entire playlist |
| `--force-write-archive` | - | - | Force archive writes even in simulate |
| `--newline` | - | - | Progress as new lines |
| `--no-progress` | - | - | No progress bar |
| `--progress` | - | - | Show progress even in quiet |
| `--console-title` | - | - | Progress in console titlebar |
| `--progress-template` | - | `[TYPES:]TEMPLATE` | Progress output template |
| `--progress-delta` | - | `SECONDS` | Time between progress output |
| `--verbose` | `-v` | - | Debug info |
| `--print-traffic` | - | - | Display HTTP traffic |

### 2.10 Workarounds

| Flag | Arg | Description |
|------|-----|-------------|
| `--encoding` | `ENCODING` | Force encoding (experimental) |
| `--legacy-server-connect` | - | Allow legacy SSL renegotiation |
| `--no-check-certificates` | - | Suppress HTTPS cert validation |
| `--prefer-insecure` | - | Use unencrypted connection |
| `--add-headers` | `FIELD:VALUE` | Custom HTTP header |
| `--bidi-workaround` | - | Bidirectional text workaround |
| `--sleep-requests` | `SECONDS` | Sleep between extraction requests |
| `--sleep-interval` | `SECONDS` | Sleep before each download (min) |
| `--max-sleep-interval` | `SECONDS` | Max sleep (with --min-sleep-interval) |
| `--sleep-subtitles` | `SECONDS` | Sleep before subtitle download |

### 2.11 Video Format Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--format` | `-f` | `FORMAT` | Video format code/selector |
| `--format-sort` | `-S` | `SORTORDER` | Sort formats by fields |
| `--format-sort-reset` | - | - | Reset sort order to default |
| `--format-sort-force` | `--S-force` | - | Force user sort order |
| `--video-multistreams` | - | - | Allow multiple video streams |
| `--audio-multistreams` | - | - | Allow multiple audio streams |
| `--prefer-free-formats` | - | - | Prefer free containers |
| `--check-formats` | - | - | Verify formats are downloadable |
| `--check-all-formats` | - | - | Check all formats |
| `--list-formats` | `-F` | - | List available formats |
| `--merge-output-format` | - | `FORMAT` | Container for merging (mp4/mkv/avi/flv/mov/webm) |

### 2.12 Subtitle Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--write-subs` | - | - | Write subtitle file |
| `--write-auto-subs` | - | - | Write auto-generated subtitles |
| `--list-subs` | - | - | List available subtitles |
| `--sub-format` | - | `FORMAT` | Subtitle format preference (e.g. `srt` or `ass/srt/best`) |
| `--sub-langs` | - | `LANGS` | Languages to download (regex or "all") |

### 2.13 Authentication Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--username` | `-u` | `USERNAME` | Account login |
| `--password` | `-p` | `PASSWORD` | Account password |
| `--twofactor` | `-2` | `TWOFACTOR` | 2FA code |
| `--netrc` | `-n` | - | Use .netrc |
| `--netrc-location` | - | `PATH` | .netrc file location |
| `--netrc-cmd` | - | `NETRC_CMD` | Command to get credentials |
| `--video-password` | - | `PASSWORD` | Video-specific password |
| `--ap-mso` | - | `MSO` | Adobe Pass TV provider |
| `--ap-username` | - | `USERNAME` | MSO account login |
| `--ap-password` | - | `PASSWORD` | MSO account password |
| `--ap-list-mso` | - | - | List supported MSOs |
| `--client-certificate` | - | `CERTFILE` | Client cert (PEM) |
| `--client-certificate-key` | - | `KEYFILE` | Client cert private key |
| `--client-certificate-password` | - | `PASSWORD` | Client cert password |

### 2.14 Post-Processing Options

| Flag | Alias | Arg | Description |
|------|-------|-----|-------------|
| `--extract-audio` | `-x` | - | Convert to audio-only |
| `--audio-format` | - | `FORMAT` | Audio format (best/aac/alac/flac/m4a/mp3/opus/vorbis/wav) |
| `--audio-quality` | - | `QUALITY` | FFmpeg audio quality (0-10 or bitrate like 128K) |
| `--remux-video` | - | `FORMAT` | Remux container (avi/flv/gif/mkv/mov/mp4/webm/...) |
| `--recode-video` | - | `FORMAT` | Re-encode video |
| `--postprocessor-args` | `--ppa` | `NAME:ARGS` | Post-processor arguments |
| `--keep-video` | `-k` | - | Keep intermediate video |
| `--post-overwrites` | - | - | Overwrite post-processed files (default) |
| `--embed-subs` | - | - | Embed subtitles in video |
| `--embed-thumbnail` | - | - | Embed thumbnail as cover art |
| `--embed-metadata` | `--add-metadata` | - | Embed metadata/chapters/infojson |
| `--embed-chapters` | `--add-chapters` | - | Add chapter markers |
| `--embed-info-json` | - | - | Embed infojson in mkv/mka |
| `--parse-metadata` | - | `[WHEN:]FROM:TO` | Parse additional metadata from fields |
| `--replace-in-metadata` | - | `[WHEN:]FIELDS REGEX REPLACE` | Regex replace in metadata |
| `--xattrs` | - | - | Write metadata to xattrs |
| `--concat-playlist` | - | `POLICY` | Concatenate playlist (never/always/multi_video) |
| `--fixup` | - | `POLICY` | Auto-fix file faults (never/warn/detect_or_warn/force) |
| `--ffmpeg-location` | - | `PATH` | ffmpeg binary path |
| `--exec` | - | `[WHEN:]CMD` | Execute command after download |
| `--convert-subs` | `--convert-subtitles` | `FORMAT` | Convert subtitles (ass/lrc/srt/vtt) |
| `--convert-thumbnails` | - | `FORMAT` | Convert thumbnails (jpg/png/webp) |
| `--split-chapters` | - | - | Split video by chapters |
| `--remove-chapters` | - | `REGEX` | Remove chapters matching regex |
| `--force-keyframes-at-cuts` | - | - | Force keyframes at cuts (slow) |
| `--use-postprocessor` | - | `NAME[:ARGS]` | Enable plugin post-processor |

### 2.15 SponsorBlock Options

| Flag | Arg | Description |
|------|-----|-------------|
| `--sponsorblock-mark` | `CATS` | Create chapters for SponsorBlock categories |
| `--sponsorblock-remove` | `CATS` | Remove SponsorBlock segments |
| `--sponsorblock-chapter-title` | `TEMPLATE` | Chapter title template |
| `--no-sponsorblock` | - | Disable SponsorBlock |
| `--sponsorblock-api` | `URL` | API URL (default: `https://sponsor.ajay.app`) |

**Categories:** sponsor, intro, outro, selfpromo, preview, filler, interaction, music_offtopic, hook, poi_highlight, chapter, all, default

### 2.16 Extractor Options

| Flag | Arg | Description |
|------|-----|-------------|
| `--extractor-retries` | `RETRIES` | Retries for extractor errors (default: 3) |
| `--allow-dynamic-mpd` | - | Process dynamic DASH manifests (default) |
| `--ignore-dynamic-mpd` | - | Don't process dynamic DASH |
| `--hls-split-discontinuity` | - | Split HLS at ad breaks |
| `--extractor-args` | `IE_KEY:ARGS` | Pass arguments to specific extractor |

### 2.17 Preset Aliases

| Flag | Expands to |
|------|-----------|
| `-t mp3` | `-f 'ba[acodec^=mp3]/ba/b' -x --audio-format mp3` |
| `-t aac` | `-f 'ba[acodec^=aac]/ba[acodec^=mp4a.40.]/ba/b' -x --audio-format aac` |
| `-t mp4` | `--merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac` |
| `-t mkv` | `--merge-output-format mkv --remux-video mkv` |
| `-t sleep` | `--sleep-subtitles 5 --sleep-requests 0.75 --sleep-interval 10 --max-sleep-interval 20` |

---

## 3. Format Selection (`-f`)

### 3.1 Special Format Selectors

| Selector | Description |
|----------|-------------|
| `all` | Select all formats separately |
| `mergeall` | Select and merge all formats (needs multistream flags) |
| `b*` / `best*` | Best format with video OR audio |
| `b` / `best` | Best format with BOTH video and audio |
| `bv` / `bestvideo` | Best video-only format |
| `bv*` / `bestvideo*` | Best format that CONTAINS video |
| `ba` / `bestaudio` | Best audio-only format |
| `ba*` / `bestaudio*` | Best format that CONTAINS audio |
| `w*` / `worst*` | Worst with video or audio |
| `w` / `worst` | Worst with both |
| `wv` / `worstvideo` | Worst video-only |
| `wa` / `worstaudio` | Worst audio-only |
| `best.N` / `bv*.N` | Nth best of type |
| `-` | Interactive selection per video |

### 3.2 Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `+` | `bv+ba` | Merge formats (requires ffmpeg) |
| `/` | `22/17/18` | Fallback: try left first, then right |
| `,` | `22,17,18` | Download multiple formats |
| `[]` | `best[height=720]` | Filter condition |
| `()` | `(mp4,webm)[height<480]` | Grouping |

### 3.3 Default Format

```
bestvideo*+bestaudio/best
```
- With `--audio-multistreams`: `bestvideo+bestaudio/best`
- Without ffmpeg or streaming to stdout: `best/bestvideo+bestaudio`

### 3.4 Common Format Patterns

```bash
# Best video + best audio merged
-f "bv+ba/b"

# Best video (with audio fallback) + best audio
-f "bv*+ba/b"

# Best mp4 video + m4a audio
-f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b"

# Best audio only (highest quality)
-f "ba/b"

# Specific format by ID
-f 137
```

### 3.5 Format Filtering (Numeric)

| Field | Description |
|-------|-------------|
| `filesize` | Bytes |
| `filesize_approx` | Estimated bytes |
| `width` | Video width |
| `height` | Video height |
| `aspect_ratio` | Aspect ratio |
| `tbr` | Total bitrate (kbps) |
| `abr` | Audio bitrate (kbps) |
| `vbr` | Video bitrate (kbps) |
| `asr` | Audio sampling rate (Hz) |
| `fps` | Frame rate |
| `audio_channels` | Audio channels |
| `stretched_ratio` | Pixel aspect ratio |

**Operators:** `<`, `<=`, `>`, `>=`, `=`, `!=`, `?` (allow unknown)

### 3.6 Format Filtering (String)

| Field | Description |
|-------|-------------|
| `url` | Video URL |
| `ext` | File extension |
| `acodec` | Audio codec |
| `vcodec` | Video codec |
| `container` | Container format |
| `protocol` | Protocol (http, https, m3u8, etc.) |
| `language` | Language code |
| `dynamic_range` | HDR type |
| `format_id` | Format code |
| `resolution` | Resolution string |

**Operators:** `=`, `^=` (starts with), `$=` (ends with), `*=` (contains), `~=` (regex), prefix with `!` to negate.

### 3.7 Format Sorting (`-S`)

Default sort order: `lang,quality,res,fps,hdr:12,vcodec,channels,acodec,size,br,asr,proto,ext,hasaud,source,id`

| Sort Field | Description |
|------------|-------------|
| `hasvid` | Has video stream (always highest priority) |
| `hasaud` | Has audio stream |
| `ie_pref` | Format preference |
| `lang` | Language preference |
| `quality` | Quality |
| `source` | Source preference |
| `proto` | Protocol quality (https/ftps > http/ftp > m3u8 > ...) |
| `vcodec` | Video codec (av01 > vp9.2 > vp9 > h265 > h264 > ...) |
| `acodec` | Audio codec (flac/alac > wav > opus > vorbis > aac > mp3 > ...) |
| `codec` | Combined vcodec,acodec |
| `vext` | Video extension (mp4 > mov > webm > flv) |
| `aext` | Audio extension (m4a > aac > mp3 > ogg > opus > webm) |
| `ext` | Combined vext,aext |
| `filesize` | Exact filesize |
| `fs_approx` | Approximate filesize |
| `size` | filesize ?? fs_approx |
| `height` | Video height |
| `width` | Video width |
| `res` | Resolution (smallest dimension) |
| `fps` | Frame rate |
| `hdr` | Dynamic range (DV > HDR12 > HDR10+ > HDR10 > HLG > SDR) |
| `channels` | Audio channels |
| `tbr` / `vbr` / `abr` / `br` | Bitrates |
| `asr` | Audio sample rate |

**Prefix `+`** to reverse sort order (ascending).  
**Suffix `:VALUE`** to prefer nearest to a value (e.g. `res:720`).  
**Use `~`** to prefer closest value (e.g. `filesize~50M`).

---

## 4. Listing Available Formats

```bash
# List all formats
yt-dlp -F https://youtube.com/watch?v=VIDEO_ID

# Or with --list-formats
yt-dlp --list-formats https://youtube.com/watch?v=VIDEO_ID

# Get JSON metadata (includes formats array)
yt-dlp -j https://youtube.com/watch?v=VIDEO_ID

# Get single JSON for playlist
yt-dlp -J https://youtube.com/playlist?list=PLAYLIST_ID
```

### Parsing Formats from JSON

When using `-j` or `-J`, the JSON output includes a `formats` array. Each format object has:

```json
{
  "format_id": "137",
  "format_note": "1080p",
  "ext": "mp4",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "vcodec": "avc1.640028",
  "acodec": "none",
  "abr": 0,
  "tbr": 4500,
  "filesize": 500000000,
  "protocol": "https",
  "container": "mp4",
  "resolution": "1920x1080",
  "dynamic_range": "SDR",
  "format": "137 - 1920x1080 (1080p)"
}
```

---

## 5. Channel/Playlist Options

### 5.1 Playlist Range

```bash
# Items 1-10
--playlist-items 1-10
--playlist-items 1:10

# Items 1,3,5,7,9 (step)
--playlist-items 1:10:2

# Items 1-3 and 7 and last 5 items
--playlist-items 1:3,7,-5::2

# Reverse order
--playlist-items ::-1
```

### 5.2 Date Filtering

```bash
# Exact date
--date 20240101

# Relative dates
--date today
--date yesterday
--date today-2weeks
--date now-1month

# Range
--dateafter 20240101
--datebefore 20241231
```

### 5.3 Match Filters (`--match-filters`)

Uses any [output template field](#6-output-templates--o) with:

**Operators:**
- Numeric: `<`, `<=`, `>`, `>=`, `=`, `!=`, `?` (allow if missing)
- String: `=`, `^=` (starts), `$=` (ends), `*=` (contains), `~=` (regex)
- Presence: `field` (exists), `!field` (not exists)
- Combine: `&` for AND, multiple flags for OR
- Interactive: `--match-filters -`

**Examples:**
```bash
# Only non-live videos
--match-filters "!is_live"

# Videos with >100 likes or like_count unknown
--match-filters "like_count>?100"

# Description contains "cats & dogs" (case-insensitive)
--match-filters "description~='(?i)\\bcats & dogs\\b'"

# Multiple conditions (OR)
--match-filters "duration>300"
--match-filters "view_count>10000"

# Break on match (stops download process)
--break-match-filters "!is_live"
```

### 5.4 Other Playlist Options

```bash
# Random order
--playlist-random

# Process entries as received (disables random/reverse)
--lazy-playlist

# Skip playlist (download only video)
--no-playlist

# Force playlist download
--yes-playlist

# Archive system
--download-archive archive.txt     # Record downloaded IDs
--break-on-existing                # Stop when encountering archived video
--break-per-input                  # Reset break counters per input URL
--max-downloads 5                  # Download only 5 videos total

# Skip after errors
--skip-playlist-after-errors 3
--ignore-errors                    # Continue on error
```

---

## 6. Output Templates (`-o`)

### 6.1 General Syntax

```
%(name[.keys][addition][>strf][,alternate][&replacement][|default])[flags][width][.precision][length]type
```

Default template: `%(title)s [%(id)s].%(ext)s`

### 6.2 Format Specifiers

| Type | Description | Example |
|------|-------------|---------|
| `s` | String | `%(title)s` |
| `d` | Integer | `%(playlist_index)02d` |
| `B` | Bytes (human-readable) | `%(filesize)B` |
| `j` | JSON | `%(info)#j` |
| `h` | HTML-escaped | `%(title)h` |
| `l` | Comma-separated list | `%(tags)l` |
| `q` | Shell-quoted | `%(filepath)q` |
| `D` | Decimal suffix (e.g. 10M) | `%(filesize)D` |
| `S` | Sanitize as filename | `%(title)S` |
| `U` | Unicode NFC normalize | `%(title)U` |

### 6.3 Field Modifiers

| Modifier | Separator | Example | Description |
|----------|-----------|---------|-------------|
| Object traversal | `.` | `%(tags.0)s` | Access dict/list items |
| Slicing | `:` | `%(id.3:7)s` | Python-style slice |
| Arithmetic | `+ - *` | `%(playlist_index+10)03d` | Math on numeric fields |
| Date formatting | `>` | `%(upload_date>%Y-%m-%d)s` | strftime format |
| Alternatives | `,` | `%(release_date,upload_date\|Unknown)s` | First non-empty field wins |
| Replacement | `&` | `%(chapters&has chapters\|no chapters)s` | Conditional text |
| Default | `\|` | `%(uploader\|Unknown)s` | Fallback value |

### 6.4 Type Prefixes

Separate templates for different file types:

```bash
-o "%(title)s.%(ext)s"                              # Video
-o "subtitle:%(title)s.%(ext)s"                     # Subtitles
-o "thumbnail:%(title)s.%(ext)s"                    # Thumbnails
-o "description:%(title)s.%(ext)s"                  # Description
-o "infojson:%(title)s.%(ext)s"                     # Info JSON
-o "link:%(title)s.%(ext)s"                         # Internet shortcut
-o "chapter:%(title)s.%(ext)s"                      # Chapter (with --split-chapters)
-o "pl_video:%(playlist)s/%(title)s.%(ext)s"        # Concatenated playlist
```

### 6.5 All Available Fields

**Core fields:** `id`, `title`, `fulltitle`, `ext`, `alt_title`, `description`, `display_id`

**Uploader:** `uploader`, `uploader_id`, `uploader_url`

**Channel:** `channel`, `channel_id`, `channel_url`, `channel_follower_count`, `channel_is_verified`

**Dates:** `timestamp`, `upload_date`, `release_timestamp`, `release_date`, `release_year`, `modified_timestamp`, `modified_date`, `epoch`

**Media:** `duration`, `duration_string`, `view_count`, `concurrent_view_count`, `like_count`, `dislike_count`, `repost_count`, `average_rating`, `comment_count`, `save_count`, `age_limit`

**Status:** `live_status`, `is_live`, `was_live`, `playable_in_embed`, `availability`, `media_type`

**Timestamps:** `start_time`, `end_time`

**Extractor:** `extractor`, `extractor_key`

**Auto-numbering:** `autonumber`, `video_autonumber`

**Playlist:** `n_entries`, `playlist_id`, `playlist_title`, `playlist`, `playlist_count`, `playlist_index`, `playlist_autonumber`, `playlist_uploader`, `playlist_uploader_id`, `playlist_channel`, `playlist_channel_id`, `playlist_webpage_url`

**URLs:** `webpage_url`, `webpage_url_basename`, `webpage_url_domain`, `original_url`

**Content:** `categories`, `tags`, `cast`, `license`, `creators`, `creator`, `location`

**Series/Episode:** `series`, `series_id`, `season`, `season_number`, `season_id`, `episode`, `episode_number`, `episode_id`

**Music:** `track`, `track_number`, `track_id`, `artists`, `artist`, `genres`, `genre`, `composers`, `composer`, `album`, `album_type`, `album_artists`, `album_artist`, `disc_number`

**Chapter/Section:** `chapter`, `chapter_number`, `chapter_id`, `section_title`, `section_number`, `section_start`, `section_end`

**Post-download:** `filepath`, `filename`, `urls`, `formats_table`, `thumbnails_table`, `subtitles_table`, `automatic_captions_table`

---

## 7. ffmpeg Version Checking

### johnvansickle.com (Linux Static Builds)

**URL:** https://johnvansickle.com/ffmpeg/

Git master builds are named like `ffmpeg-git-amd64-static.tar.xz` and have a build date.

Release builds are named like `ffmpeg-release-amd64-static.tar.xz` with version number.

The latest git master build date and release version are shown on the page.

**Architecture download URLs:**

| Architecture | Git Master | Release |
|-------------|------------|---------|
| amd64 | `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz` | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz` |
| i686 | `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-i686-static.tar.xz` | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz` |
| arm64 | `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-arm64-static.tar.xz` | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz` |
| armhf | `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-armhf-static.tar.xz` | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz` |
| armel | `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-armel-static.tar.xz` | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armel-static.tar.xz` |

**MD5 checksums:** append `.md5` to download URL.

**Build info (version):**
- Git master: `https://johnvansickle.com/ffmpeg/git-readme.txt`
- Release: `https://johnvansickle.com/ffmpeg/release-readme.txt`

### yt-dlp FFmpeg-Builds (Cross-platform)

GitHub: https://github.com/yt-dlp/FFmpeg-Builds

Releases: `https://api.github.com/repos/yt-dlp/FFmpeg-Builds/releases/latest`

### Checking local ffmpeg version

```bash
ffmpeg -version    # First line has version string
ffprobe -version   # First line has version string
```

---

## 8. Configuration Files

yt-dlp loads config from these locations (in order):

1. `--config-locations` (explicit)
2. `yt-dlp.conf` in same dir as binary (portable)
3. `yt-dlp.conf` in home path (from `-P`)
4. `${XDG_CONFIG_HOME}/yt-dlp/config` (user config, Linux/macOS)
5. `${APPDATA}/yt-dlp/config` (user config, Windows)
6. `/etc/yt-dlp/config` (system config)

---

## Node.js Wrapper Implementation Notes

### Spawning yt-dlp

```js
const { spawn } = require('child_process');

// Build args array
const args = [
  '-f', 'bv*+ba/b',
  '-o', '%(title)s.%(ext)s',
  '--print', 'after_move:filepath',
  url
];

const proc = spawn('yt-dlp', args);
proc.stdout.on('data', (data) => { /* handle output */ });
proc.stderr.on('data', (data) => { /* handle progress */ });
proc.on('close', (code) => { /* handle exit */ });
```

### Progress Parsing

yt-dlp outputs progress to stderr by default. Use `--progress-template` or `--newline` for machine-parseable output.

```js
// Use --progress-template for structured progress
const args = [
  '--progress-template',
  'download:%(progress._percentage_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
  url
];
```

### JSON Extraction

```js
const args = ['-j', '--no-simulate', url];  // Get JSON and download
const args = ['-j', '-s', url];              // Get JSON without downloading
const args = ['-J', url];                    // Full playlist JSON
```

### Detecting yt-dlp Version

```js
const { execSync } = require('child_process');
const version = execSync('yt-dlp --version').toString().trim();
```

### Download with Events (Example Architecture)

```js
class YtDlpWrapper {
  constructor(binaryPath = 'yt-dlp') { this.binary = binaryPath; }

  async getVersion() { /* yt-dlp --version */ }
  async getLatestRelease() { /* GitHub API */ }
  async download(url, options) {
    // Build args from options, spawn process, emit events
    // Events: progress, metadata, error, complete
  }
  async listFormats(url) {
    // yt-dlp -j URL, parse formats array
  }
  async getMetadata(url) {
    // yt-dlp -j -s URL, return parsed JSON
  }
}
```
