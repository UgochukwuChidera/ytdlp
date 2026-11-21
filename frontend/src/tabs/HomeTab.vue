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
        <button class="btn btn-quiet adv-toggle" type="button" @click="showAdvanced = !showAdvanced" :aria-expanded="showAdvanced">
          {{ showAdvanced ? 'Hide advanced' : 'Advanced' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :style="{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <div class="output-mode" role="group" aria-label="Output type">
        <button
          type="button"
          class="output-mode-btn"
          :class="{ active: outputMode === 'video' }"
          :aria-pressed="outputMode === 'video'"
          @click="setOutputMode('video')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3"/></svg>
          Video
        </button>
        <button
          type="button"
          class="output-mode-btn"
          :class="{ active: outputMode === 'audio' }"
          :aria-pressed="outputMode === 'audio'"
          @click="setOutputMode('audio')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Audio
        </button>
      </div>

      <div v-if="formatOverride" class="format-override">
        <div>
          <strong>Using format {{ formatOverride }}</strong>
          <p v-if="formatOverrideMeta">
            {{ formatOverrideMeta.ext }} · {{ formatResolution(formatOverrideMeta) }} · {{ formatCodec(formatOverrideMeta) }}
            <span class="format-kind" :class="formatKindClass(formatOverrideMeta)">
              {{ formatKindLabel(formatOverrideMeta) }}
            </span>
          </p>
          <p v-if="formatOverrideIsVideoOnly" class="override-warning">
            This format has no audio track. Pick “+ Audio” in List Formats to include the best audio.
          </p>
          <p v-else-if="formatOverrideIncludesAudio" class="override-note">
            The best audio stream will be downloaded and merged with this video.
          </p>
        </div>
        <div class="override-actions">
          <button class="btn btn-sm" type="button" @click="listFormats">Change</button>
          <button class="btn btn-quiet btn-sm" type="button" @click="clearFormatOverride">Clear</button>
        </div>
      </div>

      <template v-else>
        <div v-if="outputMode === 'video'" class="format-row">
          <div class="field-label">
            <label for="quality-select">Resolution</label>
            <BaseTooltip text="Caps the video height. Best available keeps the highest resolution the source offers." label="About resolution" />
          </div>
          <BaseSelect id="quality-select" v-model="videoQuality" :options="qualityOptions" aria-label="Resolution" />
        </div>
        <div v-if="outputMode === 'video'" class="format-row">
          <div class="field-label">
            <label for="container-select">Container</label>
            <BaseTooltip text="The file container yt-dlp merges the streams into. Auto lets yt-dlp decide." label="About container" />
          </div>
          <BaseSelect id="container-select" v-model="container" :options="containerOptions" aria-label="Container" />
        </div>
        <div v-if="outputMode === 'audio'" class="format-row">
          <div class="field-label">
            <label for="audio-quality-select">Quality</label>
            <BaseTooltip text="Bitrate passed to the audio encoder. Best uses yt-dlp's highest available quality." label="About audio quality" />
          </div>
          <BaseSelect id="audio-quality-select" v-model="audioQuality" :options="audioQualityOptions" aria-label="Audio quality" />
        </div>
        <div v-if="outputMode === 'audio'" class="format-row">
          <div class="field-label">
            <label for="audio-format-select">Audio format</label>
            <BaseTooltip text="Format for the extracted audio. m4a usually avoids re-encoding; lossless formats keep the source audio." label="About audio format" />
          </div>
          <BaseSelect id="audio-format-select" v-model="audioFormat" :options="audioFormatOptions" aria-label="Audio format" />
        </div>
      </template>

      <div v-if="showAdvanced" class="advanced-box">
        <div class="format-row">
          <div class="field-label">
            <label for="output-template">Filename template</label>
            <BaseTooltip text="yt-dlp output template. %(title)s.%(ext)s keeps the video title and real extension." label="About filename templates" />
          </div>
          <input id="output-template" type="text" v-model="outputTemplate" placeholder="%(title)s.%(ext)s">
        </div>
        <div class="format-row">
          <button class="btn" type="button" @click="listFormats" :disabled="!url.trim() || fetchingFormats">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px"><path d="M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01"/></svg>
            List Formats
          </button>
          <span class="format-hint">Pick an individual yt-dlp format instead of the presets.</span>
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
          <div>
            <h3>Available Formats</h3>
            <p class="modal-hint">Click a row to use that format for the next download.</p>
          </div>
          <button class="modal-close" @click="closeFormatModal" aria-label="Close formats">&times;</button>
        </div>
        <div class="format-toolbar">
          <span class="format-count" role="status" aria-live="polite">
            <template v-if="fetchingFormats">Fetching formats…</template>
            <template v-else>{{ visibleFormats.length }} of {{ formatList.length }} formats</template>
          </span>
          <button v-if="hasActiveFilters" class="btn btn-quiet btn-sm" type="button" @click="clearFormatFilters">
            Clear filters
          </button>
        </div>
        <div class="modal-table-wrap">
          <table class="format-table">
            <thead>
              <tr>
                <th
                  v-for="col in formatColumns"
                  :key="col.key"
                  :aria-sort="ariaSort(col.key)"
                  scope="col"
                >
                  <button class="sort-btn" type="button" @click="toggleSort(col.key)">
                    {{ col.label }}
                    <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(col.key) }}</span>
                  </button>
                </th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
              <tr class="filter-row">
                <th v-for="col in formatColumns" :key="`filter-${col.key}`">
                  <input
                    v-model="formatFilters[col.key]"
                    type="text"
                    class="format-filter"
                    :placeholder="`Filter ${col.label.toLowerCase()}`"
                    :aria-label="`Filter by ${col.label}`"
                    :disabled="fetchingFormats"
                  >
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody v-if="fetchingFormats">
              <tr v-for="n in 6" :key="`skeleton-${n}`" class="skeleton-row" aria-hidden="true">
                <td v-for="col in 8" :key="`skeleton-${n}-${col}`">
                  <span class="skeleton-bar" :style="{ width: `${45 + ((n * col) % 40)}%` }"></span>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="visibleFormats.length === 0">
              <tr>
                <td colspan="8" class="format-empty">
                  <template v-if="formatError">{{ formatError }}</template>
                  <template v-else-if="formatList.length === 0">
                    No formats returned. Check the URL and try again.
                  </template>
                  <template v-else>
                    No formats match these filters.
                    <button class="link-btn" type="button" @click="clearFormatFilters">Clear filters</button>
                  </template>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr
                v-for="fmt in visibleFormats"
                :key="fmt.format_id"
                @click="selectFormat(fmt)"
                class="format-row-clickable"
                :class="{ 'format-row-selected': isSelectedFormat(fmt) }"
              >
                <td>{{ fmt.format_id }}</td>
                <td>{{ fmt.ext }}</td>
                <td>{{ formatResolution(fmt) }}</td>
                <td>{{ formatBitrate(fmt) }}</td>
                <td>{{ formatSize(fmt) }}</td>
                <td>{{ fmt.format_note || '' }}</td>
                <td>{{ formatCodec(fmt) }}</td>
                <td class="format-use-cell">
                  <button class="btn btn-sm" type="button" @click.stop="selectFormat(fmt)">Use</button>
                  <button
                    v-if="isVideoOnlyFormat(fmt)"
                    class="btn btn-sm"
                    type="button"
                    title="Download this video format plus the best audio"
                    @click.stop="selectFormat(fmt, true)"
                  >
                    + Audio
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useToast } from '../composables/useToast'
import BaseSelect from '../components/BaseSelect.vue'
import BaseTooltip from '../components/BaseTooltip.vue'

const { showToast } = useToast()

const qualityOptions = [
  { value: 'best', label: 'Best available' },
  { value: '2160p', label: '2160p (4K)' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
]
const containerOptions = [
  { value: '', label: 'Auto' },
  { value: 'mp4', label: 'mp4' },
  { value: 'webm', label: 'webm' },
  { value: 'mkv', label: 'mkv' },
]
const audioQualityOptions = [
  { value: '0', label: 'Best' },
  { value: '320K', label: '320 kbps' },
  { value: '256K', label: '256 kbps' },
  { value: '192K', label: '192 kbps' },
  { value: '128K', label: '128 kbps' },
]
const audioFormatOptions = [
  { value: 'mp3', label: 'mp3' },
  { value: 'm4a', label: 'm4a' },
  { value: 'opus', label: 'opus' },
  { value: 'flac', label: 'flac' },
  { value: 'wav', label: 'wav' },
]

const url = ref('')
const results = ref([])
const fetching = ref(false)

// Video and audio are peer-level output modes. Each keeps its own settings so
// switching back and forth preserves what the user chose for that mode.
const outputMode = ref('video')
const videoQuality = ref('best')
const container = ref('')
const audioQuality = ref('0')
const audioFormat = ref('m4a')

// An individual format picked from List Formats overrides the presets. It is
// an explicit advanced action, never a competing entry in the quality menu.
const formatOverride = ref('')
const outputTemplate = ref('')
const showAdvanced = ref(false)
const fetchingFormats = ref(false)
const showFormatModal = ref(false)
const formatList = ref([])
const formatError = ref('')

const formatColumns = [
  { key: 'format_id', label: 'Code' },
  { key: 'ext', label: 'Ext' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'bitrate', label: 'Bitrate' },
  { key: 'size', label: 'Size' },
  { key: 'note', label: 'Note' },
  { key: 'codec', label: 'Codec' },
]
const formatFilters = reactive(
  Object.fromEntries(formatColumns.map((col) => [col.key, ''])),
)
const sortKey = ref('')
const sortDir = ref('asc')

const hasActiveFilters = computed(() =>
  formatColumns.some((col) => formatFilters[col.key].trim() !== ''),
)

function formatColumnText(fmt, key) {
  switch (key) {
    case 'format_id': return String(fmt.format_id ?? '')
    case 'ext': return fmt.ext || ''
    case 'resolution': return formatResolution(fmt)
    case 'bitrate': return formatBitrate(fmt)
    case 'size': return formatSize(fmt)
    case 'note': return fmt.format_note || ''
    case 'codec': return formatCodec(fmt)
    default: return ''
  }
}

function formatSortValue(fmt, key) {
  switch (key) {
    case 'format_id': {
      const n = Number(fmt.format_id)
      return Number.isFinite(n) ? n : String(fmt.format_id ?? '')
    }
    case 'ext': return fmt.ext || ''
    case 'resolution': return (Number(fmt.height) || 0) * 10000 + (Number(fmt.width) || 0)
    case 'bitrate': return Number(fmt.tbr || fmt.abr || fmt.vbr) || 0
    case 'size': return Number(fmt.filesize || fmt.filesize_approx) || 0
    case 'note': return fmt.format_note || ''
    case 'codec': return formatCodec(fmt)
    default: return ''
  }
}

const visibleFormats = computed(() => {
  const rows = formatList.value.filter((fmt) =>
    formatColumns.every((col) => {
      const needle = formatFilters[col.key].trim().toLowerCase()
      if (!needle) return true
      return formatColumnText(fmt, col.key).toLowerCase().includes(needle)
    }),
  )
  if (!sortKey.value) return rows
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = formatSortValue(a, sortKey.value)
    const vb = formatSortValue(b, sortKey.value)
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir
    }
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir
  })
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function ariaSort(key) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function sortIndicator(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function clearFormatFilters() {
  for (const col of formatColumns) formatFilters[col.key] = ''
}

function hasVideoStream(fmt) {
  return Boolean(fmt?.vcodec && fmt.vcodec !== 'none')
}

function hasAudioStream(fmt) {
  return Boolean(fmt?.acodec && fmt.acodec !== 'none')
}

function isVideoOnlyFormat(fmt) {
  return hasVideoStream(fmt) && !hasAudioStream(fmt)
}

function formatKindLabel(fmt) {
  if (hasVideoStream(fmt) && hasAudioStream(fmt)) return 'Video + audio'
  if (hasVideoStream(fmt)) return 'Video only'
  if (hasAudioStream(fmt)) return 'Audio only'
  return 'Format'
}

function formatKindClass(fmt) {
  if (hasVideoStream(fmt) && hasAudioStream(fmt)) return 'kind-muxed'
  if (hasVideoStream(fmt)) return 'kind-video'
  if (hasAudioStream(fmt)) return 'kind-audio'
  return 'kind-other'
}

function isSelectedFormat(fmt) {
  return Boolean(formatOverrideMeta.value) &&
    String(fmt.format_id) === String(formatOverrideMeta.value.format_id)
}

const formatOverrideMeta = computed(() => {
  if (!formatOverride.value) return null
  const id = String(formatOverride.value).split('+')[0]
  return formatList.value.find((fmt) => String(fmt.format_id) === id) || null
})

const formatOverrideIncludesAudio = computed(() => {
  return formatOverride.value.includes('+bestaudio')
})

const formatOverrideIsVideoOnly = computed(() => {
  if (!formatOverrideMeta.value) return false
  return isVideoOnlyFormat(formatOverrideMeta.value) && !formatOverrideIncludesAudio.value
})

const singleResult = computed(() => {
  return results.value.length === 1 ? results.value[0] : null
})

function setOutputMode(mode) {
  if (outputMode.value === mode) return
  outputMode.value = mode
  // A specific format belongs to the mode it was picked for; drop it rather
  // than submit a stale, incompatible selector after a mode switch.
  formatOverride.value = ''
}

// Seed the per-download controls from the saved defaults; the user can still
// override them for an individual job.
onMounted(async () => {
  try {
    const res = await fetch('/api/output-defaults')
    if (!res.ok) return
    const defaults = await res.json()
    if (defaults.videoFormat) {
      container.value = defaults.videoFormat === 'auto' ? '' : defaults.videoFormat
    }
    if (defaults.audioFormat) audioFormat.value = defaults.audioFormat
  } catch {}
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
  formatError.value = ''
  clearFormatFilters()
  sortKey.value = ''
  sortDir.value = 'asc'
  showFormatModal.value = true
  try {
    const res = await fetch(`/api/format-list?url=${encodeURIComponent(url.value.trim())}`)
    if (res.ok) {
      formatList.value = await res.json()
    } else {
      formatError.value = 'Failed to fetch formats. Close the dialog and try again.'
      showToast('Failed to fetch formats', 'error')
    }
  } catch (e) {
    formatError.value = 'Could not reach the server: ' + e.message
    showToast('Error: ' + e.message, 'error')
  } finally {
    fetchingFormats.value = false
  }
}

function closeFormatModal() {
  showFormatModal.value = false
}

function selectFormat(fmt, withAudio = false) {
  formatOverride.value = withAudio ? `${fmt.format_id}+bestaudio` : String(fmt.format_id)
  showAdvanced.value = true
  showFormatModal.value = false
  showToast(
    withAudio
      ? `Using format ${fmt.format_id} plus the best audio`
      : `Using format ${fmt.format_id} for the next download`,
    'success',
  )
}

function clearFormatOverride() {
  formatOverride.value = ''
}

async function queueVideo(video) {
  const body = {
    url: video.url || video.webpage_url,
    outputTemplate: outputTemplate.value.trim() || undefined,
  }
  if (formatOverride.value) {
    body.formatSelector = formatOverride.value
  } else if (outputMode.value === 'audio') {
    body.audioOnly = true
    body.audioFormat = audioFormat.value
    body.audioQuality = audioQuality.value
  } else {
    body.quality = videoQuality.value
    body.format = container.value || 'auto'
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
  border-radius: 13px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}
.video-card:hover {
  border-color: var(--line);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
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
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
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
.output-mode {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface), var(--brand-soft) 45%);
  box-shadow: 0 2px 0 var(--line);
}
.output-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.output-mode-btn:hover {
  color: var(--text);
}
.output-mode-btn.active {
  color: #241d28;
  background: var(--accent);
  border-color: var(--line);
  box-shadow: 0 2px 0 var(--line);
}
.format-override {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}
.format-override strong {
  font-size: 13px;
}
.format-override p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.override-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.format-kind {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  vertical-align: 1px;
}
.kind-video {
  background: var(--brand-soft);
  color: var(--brand);
}
.kind-audio {
  background: var(--green-soft);
  color: var(--green);
}
.kind-muxed {
  background: var(--blue-soft);
  color: var(--blue);
}
.kind-other {
  background: var(--surface-3);
  color: var(--muted);
}
.override-warning {
  color: var(--amber) !important;
}
.override-note {
  color: var(--muted);
}
.advanced-box {
  margin-top: 12px;
  padding-top: 4px;
  border-top: 1px solid var(--line-soft);
}
.format-hint {
  color: var(--muted);
  font-size: 12px;
}
.format-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.format-row label {
  font-size: 13px;
  font-weight: 660;
  color: var(--text);
}
.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 160px;
  flex-shrink: 0;
}
.format-row input[type="text"] {
  flex: 1;
  max-width: 400px;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}
.format-row input[type="text"]:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}
.format-row :deep(.select) {
  flex: 1;
  max-width: 400px;
}

@media (max-width: 860px) {
  .format-row {
    align-items: stretch;
    flex-direction: column;
    gap: 7px;
  }
  .format-row label {
    width: auto;
  }
  .field-label {
    width: auto;
  }
  .format-row input[type="text"],
  .format-row :deep(.select) {
    max-width: none;
    width: 100%;
  }
  .format-override {
    align-items: flex-start;
    flex-direction: column;
  }
  .format-hint {
    display: block;
  }
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
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-header h3 {
  margin: 0;
  font-size: 16px;
}
.modal-hint {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
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
.format-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--line-soft);
}
.format-count {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.modal-table-wrap {
  flex: 1;
  min-height: 260px;
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
  z-index: 3;
  padding: 0;
  background: var(--surface-2);
  text-align: left;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.sort-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
}
.sort-btn:hover,
.sort-btn:focus-visible {
  color: var(--text);
  outline: none;
}
.sort-indicator {
  color: var(--faint);
  font-size: 10px;
}
.sort-btn:hover .sort-indicator,
.sort-btn:focus-visible .sort-indicator {
  color: var(--brand);
}
.filter-row th {
  top: 38px;
  z-index: 2;
  padding: 6px 8px;
  background: var(--surface-2);
}
.format-filter {
  width: 100%;
  min-width: 78px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 11px;
  text-transform: none;
  letter-spacing: normal;
}
.format-filter::placeholder {
  color: var(--faint);
}
.format-filter:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}
.format-filter:disabled {
  opacity: 0.55;
}
.format-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-soft);
  white-space: nowrap;
}
.skeleton-row td {
  padding: 11px 12px;
}
.skeleton-bar {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 37%, var(--surface-2) 63%);
  background-size: 400% 100%;
  animation: skeleton-sweep 1.2s ease-in-out infinite;
}
@keyframes skeleton-sweep {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}
.format-empty {
  padding: 42px 16px !important;
  text-align: center;
  color: var(--muted);
  white-space: normal;
}
.link-btn {
  padding: 0 3px;
  border: none;
  background: none;
  color: var(--brand);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
.format-row-clickable {
  cursor: pointer;
  transition: background 100ms ease;
}
.format-row-clickable:hover {
  background: var(--brand-soft);
}
.format-row-selected {
  background: var(--brand-soft);
}
.format-row-selected td:first-child {
  box-shadow: inset 3px 0 0 var(--brand);
}
.format-use-cell {
  text-align: right;
}

/* Button small variant */
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
