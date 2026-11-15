<template>
  <main class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Downloader</div>
        <h1>Download media with confidence.</h1>
        <p class="lede">Paste a video, playlist, or channel URL, inspect metadata, choose output settings, and send the job to the queue.</p>
      </div>
    </div>

    <section class="panel download-command" aria-label="Download URL">
      <input type="text" v-model="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off" @keyup.enter="fetchMetadata">
      <button class="btn btn-primary" type="button" @click="fetchMetadata" :disabled="fetching">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        Fetch Metadata
      </button>
      <button class="btn" type="button" @click="scrapePlaylist" :disabled="fetching">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px"><path d="M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01"/></svg>
        Scrape Playlist
      </button>
    </section>

    <section class="panel panel-pad format-section">
      <div class="section-title">
        <h2>Output</h2>
        <button class="btn btn-quiet adv-toggle" type="button" @click="showAdvanced = !showAdvanced">
          {{ showAdvanced ? 'Hide advanced' : 'Advanced' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :style="{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="format-row">
        <label>Quality</label>
        <select v-model="formatType">
          <option value="best">best</option>
          <option value="bestvideo+bestaudio">bestvideo+bestaudio</option>
          <option value="bestaudio">bestaudio (audio only)</option>
          <option value="custom">custom</option>
        </select>
      </div>
      <div v-if="advancedOpen">
        <div class="format-row">
          <label>Container</label>
          <select v-model="container">
            <option value="">Auto</option>
            <option value="mp4">mp4</option>
            <option value="webm">webm</option>
            <option value="mkv">mkv</option>
          </select>
        </div>
        <div class="format-row" v-if="formatType === 'bestaudio'">
          <label>Audio format</label>
          <select v-model="audioFormat">
            <option value="mp3">mp3</option>
            <option value="m4a">m4a</option>
            <option value="opus">opus</option>
            <option value="flac">flac</option>
            <option value="wav">wav</option>
          </select>
        </div>
        <div class="format-row" v-if="formatType === 'custom'">
          <label>Custom format</label>
          <input type="text" v-model="customFormat" placeholder="bestvideo[height<=1080]+bestaudio/best">
        </div>
        <div class="format-row">
          <label>Filename template</label>
          <input type="text" v-model="outputTemplate" placeholder="%(title)s.%(ext)s">
        </div>
        <div class="format-row">
          <button class="btn" type="button" @click="listFormats" :disabled="!url.trim() || fetchingFormats">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px"><path d="M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01"/></svg>
            List Formats
          </button>
        </div>
      </div>
    </section>

    <section v-if="results.length > 0" class="panel panel-pad">
      <div class="section-title">
        <h2>Results</h2>
      </div>

      <div v-if="singleResult && singleResult.title" class="single-result">
        <div class="single-thumb">
          <img v-if="singleResult.thumbnail" :src="singleResult.thumbnail" :alt="singleResult.title">
        </div>
        <div class="single-info">
          <h3>{{ singleResult.title }}</h3>
          <p v-if="singleResult.uploader" class="single-meta">{{ singleResult.uploader }}</p>
          <p v-if="singleResult.duration" class="single-meta">Duration: {{ formatDuration(singleResult.duration) }}</p>
          <div class="download-actions">
            <button class="btn btn-primary" type="button" @click="queueVideo(singleResult)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Queue Download
            </button>
          </div>
        </div>
      </div>

      <div v-else class="results-grid">
        <div
          v-for="(video, idx) in results"
          :key="video.id || video.url || idx"
          class="video-card spotlight-card"
        >
          <div class="video-card-thumb">
            <img v-if="video.thumbnail" :src="video.thumbnail" :alt="video.title" loading="lazy">
            <div v-else class="thumb-placeholder"></div>
            <span v-if="video.duration" class="duration-badge">{{ formatDuration(video.duration) }}</span>
          </div>
          <div class="video-card-info">
            <h3 class="line-clamp-2">{{ video.title }}</h3>
            <p class="video-card-meta">
              {{ video.uploader || '' }}{{ video.uploader && video.uploadDate ? ' · ' : '' }}{{ video.uploadDate ? formatDate(video.uploadDate) : '' }}
              <span v-if="video.viewCount"> · {{ formatNumber(video.viewCount) }} views</span>
            </p>
            <button class="btn btn-primary btn-sm" type="button" @click.stop="queueVideo(video)" style="margin-top:8px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Queue Download
            </button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="fetching" class="panel panel-pad">
      <div class="loading-state">
        <div class="loader"></div>
        <p>Fetching metadata...</p>
      </div>
    </section>

    <!-- Format Modal -->
    <div v-if="showFormatModal" class="modal-backdrop" @click.self="closeFormatModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Available Formats</h3>
          <button class="modal-close" @click="closeFormatModal">&times;</button>
        </div>
        <div class="modal-table-wrap">
          <table class="format-table">
            <thead>
              <tr>
                <th>Code</th><th>Ext</th><th>Resolution</th><th>Bitrate</th><th>Size</th><th>Note</th><th>Codec</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fmt in formatList" :key="fmt.format_id" @click="selectFormat(fmt)" class="format-row-clickable">
                <td>{{ fmt.format_id }}</td>
                <td>{{ fmt.ext }}</td>
                <td>{{ formatResolution(fmt) }}</td>
                <td>{{ formatBitrate(fmt) }}</td>
                <td>{{ formatSize(fmt) }}</td>
                <td>{{ fmt.format_note || '' }}</td>
                <td>{{ formatCodec(fmt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from '../composables/useToast'

const { showToast } = useToast()

const url = ref('')
const results = ref([])
const fetching = ref(false)
const formatType = ref('best')
const container = ref('')
const audioFormat = ref('mp3')
const outputTemplate = ref('')
const customFormat = ref('')
// Advanced output controls (container, audio format, custom selector,
// filename template) are tucked away behind a disclosure; picking the
// "custom" quality auto-opens it since it needs its input.
const showAdvanced = ref(false)
const advancedOpen = computed(() => showAdvanced.value || formatType.value === 'custom')
const fetchingFormats = ref(false)
const showFormatModal = ref(false)
const formatList = ref([])

const singleResult = computed(() => {
  return results.value.length === 1 ? results.value[0] : null
})

async function fetchMetadata() {
  if (!url.value.trim()) return
  fetching.value = true
  results.value = []
  try {
    const res = await fetch(`/api/metadata?url=${encodeURIComponent(url.value.trim())}`)
    if (res.ok) {
      const data = await res.json()
      if (data.entries) {
        results.value = data.entries
      } else {
        results.value = [data]
      }
    } else {
      showToast('Failed to fetch metadata', 'error')
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error')
  } finally {
    fetching.value = false
  }
}

async function scrapePlaylist() {
  if (!url.value.trim()) return
  fetching.value = true
  results.value = []
  try {
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(url.value.trim())}`)
    if (res.ok) {
      const data = await res.json()
      if (data.entries) {
        results.value = data.entries
      } else {
        results.value = [data]
      }
    } else {
      showToast('Failed to scrape playlist', 'error')
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error')
  } finally {
    fetching.value = false
  }
}

async function listFormats() {
  if (!url.value.trim()) return
  fetchingFormats.value = true
  formatList.value = []
  showFormatModal.value = true
  try {
    const res = await fetch(`/api/format-list?url=${encodeURIComponent(url.value.trim())}`)
    if (res.ok) {
      formatList.value = await res.json()
    } else {
      showToast('Failed to fetch formats', 'error')
      showFormatModal.value = false
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error')
    showFormatModal.value = false
  } finally {
    fetchingFormats.value = false
  }
}

function closeFormatModal() {
  showFormatModal.value = false
}

function selectFormat(fmt) {
  formatType.value = 'custom'
  customFormat.value = fmt.format_id
  showFormatModal.value = false
}

async function queueVideo(video) {
  const body = {
    url: video.url || video.webpage_url,
    format: container.value || undefined,
    outputTemplate: outputTemplate.value || undefined,
  }
  if (formatType.value === 'bestaudio') {
    body.audioOnly = true
    body.audioFormat = audioFormat.value
    body.quality = 'best'
  } else if (formatType.value === 'custom') {
    if (!customFormat.value.trim()) {
      showToast('Enter a custom format selector first', 'error')
      return
    }
    body.extraArgs = ['-f', customFormat.value.trim()]
  } else if (formatType.value === 'bestvideo+bestaudio') {
    body.quality = 'best'
  } else {
    body.quality = 'best'
  }
  try {
    const res = await fetch('/api/download/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showToast('Added to queue', 'success')
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to add to queue', 'error')
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error')
  }
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Unknown'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNumber(n) {
  if (!n) return ''
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatResolution(fmt) {
  if (fmt.width && fmt.height) return `${fmt.width}x${fmt.height}`
  if (fmt.resolution && fmt.resolution !== 'audio only') return fmt.resolution
  return fmt.format_note || ''
}

function formatBitrate(fmt) {
  const tbr = fmt.tbr || fmt.abr || fmt.vbr
  if (tbr) return `${Math.round(tbr)}k`
  return 'N/A'
}

function formatSize(fmt) {
  const bytes = fmt.filesize || fmt.filesize_approx
  if (!bytes) return 'N/A'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatCodec(fmt) {
  const v = fmt.vcodec || ''
  const a = fmt.acodec || ''
  if (v && a) return `${v}/${a}`
  if (v) return v
  if (a) return a
  return 'N/A'
}
</script>

<style scoped>
.single-result {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.single-thumb {
  width: 240px;
  border-radius: var(--radius);
  overflow: hidden;
  flex-shrink: 0;
}
.single-thumb img {
  width: 100%;
  display: block;
}
.single-info {
  flex: 1;
}
.single-info h3 {
  margin: 0 0 8px;
  font-size: 18px;
}
.single-meta {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 14px;
}
.download-actions {
  margin-top: 16px;
}
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.video-card {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  transition: all 140ms ease;
  background: var(--surface);
}
.video-card:hover {
  border-color: var(--brand);
}
.video-card-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface-3);
  overflow: hidden;
}
.video-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-3);
}
.video-card-info {
  padding: 12px;
}
.video-card-info h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 720;
  line-height: 1.35;
}
.video-card-meta {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}
.duration-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0,0,0,0.75);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.quality-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: var(--brand);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Format & Filename sections */
.format-section,
.filename-section {
  margin-top: 16px;
}
.adv-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 660;
}
.format-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.format-row label {
  width: 160px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 660;
  color: var(--text);
}
.format-row input[type="text"],
.format-row select {
  flex: 1;
  max-width: 400px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}
.format-row input[type="text"]:focus,
.format-row select:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

/* Modal overlay */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-content {
  background: var(--surface);
  border-radius: var(--radius);
  max-width: 900px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-header h3 {
  margin: 0;
  font-size: 16px;
}
.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--muted);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.modal-close:hover {
  color: var(--text);
}
.modal-table-wrap {
  overflow: auto;
  padding: 0;
}
.format-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.format-table th {
  position: sticky;
  top: 0;
  background: var(--surface-2);
  padding: 10px 12px;
  text-align: left;
  font-weight: 660;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.format-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-soft);
  white-space: nowrap;
}
.format-row-clickable {
  cursor: pointer;
  transition: background 100ms ease;
}
.format-row-clickable:hover {
  background: var(--brand-soft);
}

/* Button small variant */
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
