<template>
  <main class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Settings</div>
        <h1>Tune the app.</h1>
        <p class="lede">Manage binaries, concurrency, and the yt-dlp flags applied to every download.</p>
      </div>
    </div>

    <!-- ============ SYSTEM (binaries) ============ -->
    <section class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m14.7 6.3 3 3M4 20l5.5-1.5L19 9a2.1 2.1 0 0 0-3-3l-9.5 9.5L4 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        <h2 style="margin:0">System</h2>
        <div style="display:flex;gap:8px;margin-left:auto">
          <button class="btn btn-primary" type="button" @click="runSetup" :disabled="anyDownloading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ anyDownloading ? 'Downloading...' : 'Download all' }}
          </button>
          <button class="btn btn-quiet" type="button" @click="openBinaryFolder" title="Open binary folder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
          </button>
        </div>
      </div>

      <div class="binary-table">
        <div v-for="b in binaries" :key="b.name" class="binary-row">
          <div class="binary-info">
            <strong class="binary-name">{{ b.label }}</strong>
            <span v-if="b.installed" class="binary-version">{{ b.installed }}</span>
            <span v-else class="binary-version missing">Not installed</span>
            <span v-if="b.latest" class="binary-latest">latest: {{ b.latest }}</span>
          </div>
          <div class="binary-status">
            <span v-if="b.downloading" class="tag tag-brand">Downloading... {{ b.percent }}%</span>
            <span v-else-if="b.corrupt" class="tag tag-red">Corrupt</span>
            <span v-else-if="b.updateAvailable" class="tag tag-amber">Update available</span>
            <span v-else-if="b.installed" class="tag tag-green">Up to date</span>
            <span v-else class="tag tag-muted">Not installed</span>
          </div>
          <div class="binary-action">
            <button
              v-if="b.name !== 'ffprobe'"
              class="btn btn-sm"
              :class="b.updateAvailable || !b.installed ? 'btn-primary' : 'btn-quiet'"
              :disabled="b.downloading"
              @click="downloadBinary(b.name)"
            >
              {{ b.installed ? 'Update' : 'Download' }}
            </button>
            <span v-else class="btn-placeholder">Bundled with ffmpeg</span>
          </div>
        </div>
      </div>

      <!-- Concurrency -->
      <div class="concurrency-row">
        <div>
          <label class="concurrency-label" for="concurrency-select">Parallel downloads</label>
          <span class="concurrency-hint">How many yt-dlp jobs can run at the same time.</span>
        </div>
        <select id="concurrency-select" :value="concurrency" @change="setConcurrency($event)">
          <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>

      <div v-if="showProgress" class="setup-progress">
        <div style="margin-bottom:16px">
          <div class="progress-meta"><strong>yt-dlp</strong><span>{{ ytdlpStatus }}</span></div>
          <div class="bar"><div class="bar-fill" :style="{width: ytdlpPercent+'%'}"></div></div>
        </div>
        <div>
          <div class="progress-meta"><strong>ffmpeg</strong><span>{{ ffmpegStatus }}</span></div>
          <div class="bar"><div class="bar-fill" :style="{width: ffmpegPercent+'%'}"></div></div>
        </div>
      </div>

      <div v-if="setupError" class="settings-notice error-notice" style="margin-top:14px">
        Setup error: {{ setupError }}
      </div>

      <div class="settings-notice" style="margin-top:14px; font-size:12px; color:var(--muted);">
        Binaries stored at: <code style="font-size:12px">{{ binDir || 'managed app data directory' }}</code>
      </div>
    </section>

    <!-- ============ OPTIONS (yt-dlp flags) ============ -->
    <section class="panel panel-pad" style="margin-top:18px">
      <div class="section-title" style="justify-content:space-between">
        <h2 style="margin:0">Flags &amp; Options</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" type="button" @click="applyOptions" :disabled="loading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>
            Apply
          </button>
          <button class="btn" type="button" @click="resetOptions">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reset
          </button>
        </div>
      </div>

      <div v-if="platform" class="filter-bar">
        <span>Showing options for: <strong>{{ platform }}</strong></span>
        <button class="btn" type="button" @click="showAllOs = !showAllOs">
          {{ showAllOs ? 'Show relevant only' : 'Show all options' }}
        </button>
      </div>

      <div v-if="loading && !optionsDefs" class="loading-state">
        <div class="loader"></div>
        <p>Loading options...</p>
      </div>

      <div v-else>
        <div v-for="(cat, catIdx) in categories" :key="cat.key" class="category-section">
          <div class="category-header" @click="toggleCategory(cat.key)">
            <span class="category-chevron" :class="{ expanded: expandedCategories.has(cat.key) }">▶</span>
            <span class="category-label">{{ cat.label }}</span>
            <span class="option-count">{{ cat.options.length }}</span>
          </div>

          <div v-if="expandedCategories.has(cat.key)" class="category-body">
            <div v-for="opt in cat.options" :key="opt.flag" class="option-row">
              <div class="option-label">
                <label :for="inputId(opt)">{{ opt.label || opt.flag }}</label>
                <code class="option-flag">{{ opt.flag }}{{ opt.param ? ' ' + opt.param : '' }}</code>
                <code class="os-badge" :class="'os-' + (opt.os || 'all')">{{ opt.os || 'all' }}</code>
              </div>
              <div class="option-input">
                <div v-if="opt.type === 'boolean'" class="checkbox-wrap">
                  <input
                    type="checkbox"
                    :id="inputId(opt)"
                    :checked="optionValues[opt.flag] === true"
                    @change="setOption(opt.flag, $event.target.checked || undefined)"
                  >
                  <span class="checkbox-label">Enabled</span>
                </div>
                <input
                  v-else-if="opt.type === 'number'"
                  type="number"
                  :id="inputId(opt)"
                  :placeholder="opt.param || 'Number'"
                  :value="optionValues[opt.flag] || ''"
                  @change="setOption(opt.flag, $event.target.value || undefined)"
                >
                <select
                  v-else-if="opt.type === 'choice'"
                  :id="inputId(opt)"
                  :value="optionValues[opt.flag] || ''"
                  @change="setOption(opt.flag, $event.target.value || undefined)"
                >
                  <option value="">Default</option>
                  <option v-for="c in opt.choices" :key="c" :value="c">{{ c }}</option>
                </select>
                <input
                  v-else
                  type="text"
                  :id="inputId(opt)"
                  :placeholder="opt.param || 'Value'"
                  :value="optionValues[opt.flag] || ''"
                  @change="setOption(opt.flag, $event.target.value || undefined)"
                >
              </div>
            </div>
          </div>

          <div v-if="catIdx < categories.length - 1" class="section-separator"></div>
        </div>

        <div v-if="saved" class="saved-notice">Options applied successfully.</div>
        <div v-if="error" class="error-notice">{{ error }}</div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useDialog } from '../composables/useDialog'

const { confirmDialog } = useDialog()

// ══════════════ SYSTEM (binaries + concurrency) ══════════════
const binaries = ref([
  { name: 'yt-dlp', label: 'yt-dlp', installed: null, latest: null, corrupt: false, updateAvailable: false, downloading: false, percent: 0 },
  { name: 'ffmpeg', label: 'ffmpeg', installed: null, latest: null, corrupt: false, updateAvailable: false, downloading: false, percent: 0 },
  { name: 'ffprobe', label: 'ffprobe', installed: null, latest: null, corrupt: false, updateAvailable: false, downloading: false, percent: 0 },
])

const showProgress = ref(false)
const setupError = ref('')
const binDir = ref('')
const ytdlpStatus = ref('')
const ffmpegStatus = ref('')
const ytdlpPercent = ref(0)
const ffmpegPercent = ref(0)
const concurrency = ref(3)

let setupEventSource = null

const anyDownloading = computed(() => binaries.value.some(b => b.downloading))

async function fetchStatus() {
  try {
    const [statusRes, updatesRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/updates'),
    ])
    if (statusRes.ok) {
      const status = await statusRes.json()
      binDir.value = status.binDir || ''
      for (const b of status.binaries) {
        const entry = binaries.value.find(x => x.name === b.name)
        if (entry) {
          entry.installed = b.version || null
          entry.corrupt = b.corrupt || false
          if (!b.exists) entry.installed = null
        }
      }
    }
    if (updatesRes.ok) {
      const updates = await updatesRes.json()
      const ytEntry = binaries.value.find(x => x.name === 'yt-dlp')
      const ffEntry = binaries.value.find(x => x.name === 'ffmpeg')
      if (ytEntry) {
        ytEntry.latest = updates.ytDlp?.latest || null
        ytEntry.updateAvailable = updates.ytDlp?.updateAvailable || false
      }
      if (ffEntry) {
        ffEntry.latest = updates.ffmpeg?.latest || null
        ffEntry.updateAvailable = updates.ffmpeg?.updateAvailable || false
      }
      const fpEntry = binaries.value.find(x => x.name === 'ffprobe')
      if (fpEntry && ffEntry) {
        fpEntry.installed = ffEntry.installed
        fpEntry.latest = ffEntry.latest
        fpEntry.updateAvailable = ffEntry.updateAvailable
        fpEntry.corrupt = ffEntry.corrupt
      }
    }
  } catch (e) {
    console.error('Status fetch error:', e)
  }
}

async function fetchConcurrency() {
  try {
    const res = await fetch('/api/download/concurrency')
    if (res.ok) {
      const data = await res.json()
      if (Number.isFinite(Number(data.concurrency))) {
        concurrency.value = Math.min(5, Math.max(1, Number(data.concurrency)))
      }
    }
  } catch (e) {
    console.error('Concurrency fetch error:', e)
  }
}

async function setConcurrency(event) {
  const n = Number(event.target.value)
  if (!Number.isFinite(n)) return
  const prev = concurrency.value
  concurrency.value = n
  try {
    const res = await fetch('/api/download/concurrency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency: n }),
    })
    if (!res.ok) throw new Error('Failed to set concurrency')
  } catch (e) {
    console.error('Concurrency set error:', e)
    concurrency.value = prev
  }
}

async function downloadBinary(name) {
  const entry = binaries.value.find(b => b.name === name)
  if (!entry) return
  entry.downloading = true
  entry.percent = 0

  const es = new EventSource(`/api/setup/download/${name}`)
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.step === name) {
        entry.percent = data.percent || 0
      } else if (data.step === 'all' && data.status === 'done') {
        es.close()
        entry.downloading = false
        fetchStatus()
      } else if (data.step === 'error') {
        es.close()
        entry.downloading = false
        setupError.value = data.error || `Failed to download ${name}`
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }
  es.onerror = () => {
    es.close()
    entry.downloading = false
  }
}

function runSetup() {
  showProgress.value = true
  setupError.value = ''
  ytdlpStatus.value = 'Starting...'
  ffmpegStatus.value = 'Waiting...'
  ytdlpPercent.value = 0
  ffmpegPercent.value = 0

  for (const b of binaries.value) {
    if (b.name !== 'ffprobe') b.downloading = true
  }

  setupEventSource = new EventSource('/api/setup')

  setupEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.step === 'yt-dlp') {
        ytdlpStatus.value = data.status === 'done'
          ? (data.skipped ? 'Already up to date' : 'Ready')
          : data.status === 'downloading' ? 'Downloading...' : data.status
        if (typeof data.percent === 'number') {
          ytdlpPercent.value = data.percent
        }
      } else if (data.step === 'ffmpeg') {
        ffmpegStatus.value = data.status === 'done'
          ? (data.skipped ? 'Already up to date' : 'Ready')
          : data.status === 'downloading' ? 'Downloading...' : data.status
        if (typeof data.percent === 'number') {
          ffmpegPercent.value = data.percent
        }
      } else if (data.step === 'all' && data.status === 'done') {
        finishSetup()
      } else if (data.step === 'error') {
        console.error('Setup error:', data.error)
        setupError.value = data.error || 'Unknown error'
        finishSetup()
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  setupEventSource.onerror = () => {
    console.error('SSE connection error')
    finishSetup()
  }
}

function finishSetup() {
  if (setupEventSource) {
    setupEventSource.close()
    setupEventSource = null
  }
  for (const b of binaries.value) {
    b.downloading = false
  }
  fetchStatus()
  setTimeout(() => {
    showProgress.value = false
  }, 3000)
}

async function openBinaryFolder() {
  try {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'bin' }),
    })
  } catch (e) {
    console.error('Open folder error:', e)
  }
}

// ══════════════ OPTIONS (yt-dlp flags) ══════════════
const optionsDefs = ref(null)
const optionValues = reactive({})
const loading = ref(true)
const saved = ref(false)
const error = ref('')
const platform = ref('')
const showAllOs = ref(false)
const expandedCategories = reactive(new Set())

const categoryLabels = {
  general: 'General',
  videoSelection: 'Video Selection',
  downloadOptions: 'Download Options',
  filesystem: 'Filesystem',
  thumbnails: 'Thumbnails',
  subtitles: 'Subtitles',
  postProcessing: 'Post-Processing',
  network: 'Network',
  verbosity: 'Verbosity / Logging'
}

const categories = computed(() => {
  const defs = optionsDefs.value
  if (!defs || !defs._platform) return []

  const keys = Object.keys(defs).filter(k => k !== '_platform' && k !== 'saved')

  return keys.map(key => ({
    key,
    label: categoryLabels[key] || key,
    options: Array.isArray(defs[key])
      ? defs[key].filter(opt => {
          if (showAllOs.value) return true
          if (!opt.os || opt.os === 'all') return true
          return opt.os === platform.value
        })
      : []
  }))
})

function inputId(opt) {
  return 'opt-' + opt.flag
}

function toggleCategory(key) {
  if (expandedCategories.has(key)) {
    expandedCategories.delete(key)
  } else {
    expandedCategories.add(key)
  }
}

function setOption(flag, value) {
  if (value === undefined || value === '') {
    delete optionValues[flag]
  } else {
    optionValues[flag] = value
  }
}

async function loadOptions() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/options')
    if (res.ok) {
      const data = await res.json()
      optionsDefs.value = data
      platform.value = data._platform || ''

      Object.keys(data).filter(k => k !== '_platform' && k !== 'saved').forEach(k => {
        expandedCategories.add(k)
      })

      // Hydrate previously applied options so the form reflects what the
      // server actually uses; without this the form looks empty while saved
      // flags stay active on every download.
      if (data.saved && typeof data.saved === 'object') {
        for (const [k, v] of Object.entries(data.saved)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
          optionValues[k] = v
        }
      }
    } else {
      error.value = 'Failed to load options'
    }
  } catch (e) {
    error.value = 'Failed to load options: ' + e.message
  } finally {
    loading.value = false
  }
}

async function applyOptions() {
  saved.value = false
  error.value = ''
  try {
    const res = await fetch('/api/options/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { ...optionValues } }),
    })
    if (res.ok) {
      saved.value = true
      setTimeout(() => { saved.value = false }, 3000)
    } else {
      const data = await res.json()
      error.value = data.error || 'Failed to apply options'
    }
  } catch (e) {
    error.value = 'Failed to apply options: ' + e.message
  }
}

async function resetOptions() {
  const ok = await confirmDialog({
    title: 'Reset options?',
    message: 'Reset all options to their defaults?',
    confirmLabel: 'Reset',
    danger: true,
  })
  if (!ok) return
  error.value = ''
  try {
    const res = await fetch('/api/options/reset', { method: 'POST' })
    if (res.ok) {
      Object.keys(optionValues).forEach(k => delete optionValues[k])
      saved.value = true
      setTimeout(() => { saved.value = false }, 3000)
    } else {
      const data = await res.json()
      error.value = data.error || 'Failed to reset options'
    }
  } catch (e) {
    error.value = 'Failed to reset options: ' + e.message
  }
}

// ══════════════ Lifecycle ══════════════
onMounted(() => {
  fetchStatus()
  fetchConcurrency()
  loadOptions()
})

onUnmounted(() => {
  if (setupEventSource) {
    setupEventSource.close()
    setupEventSource = null
  }
})
</script>

<style scoped>
/* ── System: binaries ── */
.binary-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 14px;
}
.binary-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.binary-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.binary-name {
  font-size: 14px;
}
.binary-version {
  font-size: 12px;
  color: var(--muted);
  font-family: monospace;
}
.binary-version.missing {
  color: var(--red);
  font-family: inherit;
}
.binary-latest {
  font-size: 11px;
  color: var(--muted-dim);
  font-family: monospace;
}
.binary-status {
  flex-shrink: 0;
}
.binary-action {
  flex-shrink: 0;
  min-width: 90px;
  text-align: right;
}
.btn-placeholder {
  font-size: 11px;
  color: var(--muted-dim);
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.tag-green { background: var(--green-soft); color: var(--green); }
.tag-amber { background: var(--amber-soft); color: var(--amber); }
.tag-red { background: var(--red-soft); color: var(--red); }
.tag-brand { background: var(--brand-soft); color: var(--brand); }
.tag-muted { background: var(--surface-3); color: var(--muted); }

.btn-sm {
  min-height: 30px;
  padding: 5px 11px;
  font-size: 12px;
  gap: 5px;
}
.btn-quiet {
  color: var(--muted);
  background: transparent;
  border-color: var(--line);
}
.btn-quiet:hover {
  background: var(--surface-3);
  color: var(--text);
}

/* ── Concurrency ── */
.concurrency-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.concurrency-label {
  display: block;
  font-size: 13px;
  font-weight: 660;
}
.concurrency-hint {
  font-size: 12px;
  color: var(--muted);
}
.concurrency-row select {
  min-width: 70px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}

/* ── Setup progress ── */
.setup-progress { margin-top: 18px; }
.progress-meta { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.bar { height: 8px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--brand); border-radius: 999px; transition: width 0.3s ease; }
.settings-notice { padding: 12px 16px; border-radius: var(--radius); border: 1px solid; font-size: 13px; }

/* ── Options ── */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin: 12px 0;
  background: var(--surface-soft);
  border-radius: var(--radius);
  font-size: 13px;
}
.option-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-soft);
}
.option-row:last-child {
  border-bottom: none;
}
.option-label {
  width: 33%;
  flex-shrink: 0;
}
.option-label label {
  display: block;
  font-size: 13px;
  font-weight: 660;
  margin-bottom: 2px;
}
.option-flag {
  font-size: 11px;
  color: var(--faint);
  font-family: monospace;
}
.option-input {
  flex: 1;
}
.option-input input[type="text"],
.option-input input[type="number"],
.option-input select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}
.option-input input[type="text"]:focus,
.option-input input[type="number"]:focus,
.option-input select:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}
.checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.checkbox-wrap input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.checkbox-label {
  font-size: 13px;
  color: var(--muted);
}
.loading-state {
  text-align: center;
  padding: 40px 0;
  color: var(--muted);
}
.loader {
  width: 24px;
  height: 24px;
  border: 2px solid var(--line);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: settings-spin 0.7s linear infinite;
  margin: 0 auto 12px;
}
@keyframes settings-spin {
  to { transform: rotate(360deg); }
}
.saved-notice {
  margin-top: 16px;
  padding: 10px 14px;
  background: var(--green-soft);
  color: var(--green);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.error-notice {
  background: var(--red-soft);
  color: var(--red);
  font-weight: 600;
}

.category-section {
  margin-bottom: 0;
}
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0;
  cursor: pointer;
  user-select: none;
  font-weight: 660;
  font-size: 14px;
}
.category-header:hover {
  opacity: 0.8;
}
.category-chevron {
  font-size: 10px;
  transition: transform 0.2s ease;
  color: var(--muted);
}
.category-chevron.expanded {
  transform: rotate(90deg);
}
.category-label {
  flex: 1;
}
.option-count {
  font-size: 11px;
  color: var(--muted);
  background: var(--surface-soft);
  padding: 2px 8px;
  border-radius: 10px;
  line-height: 1.4;
}
.os-badge {
  display: inline-block;
  font-size: 10px;
  font-family: monospace;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
  line-height: 1.5;
}
.os-all {
  background: var(--surface-soft);
  color: var(--muted);
}
.os-linux {
  background: rgba(76, 175, 80, 0.12);
  color: #4caf50;
}
.os-windows {
  background: rgba(33, 150, 243, 0.12);
  color: #2196f3;
}
.os-macos {
  background: rgba(156, 39, 176, 0.12);
  color: #9c27b0;
}
.section-separator {
  height: 1px;
  background: var(--line-soft);
  margin: 4px 0;
}

/* ── Responsive ── */
@media (max-width: 720px) {
  .binary-row {
    flex-wrap: wrap;
  }
  .option-row {
    flex-direction: column;
    gap: 6px;
  }
  .option-label {
    width: 100%;
  }
}
</style>
