<template>
  <main class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Setup</div>
        <h1>Binaries and versions.</h1>
        <p class="lede">Install or refresh the yt-dlp and ffmpeg binaries used by the server.</p>
      </div>
    </div>

    <section class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m14.7 6.3 3 3M4 20l5.5-1.5L19 9a2.1 2.1 0 0 0-3-3l-9.5 9.5L4 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        <h2 style="margin:0">Setup Dependencies</h2>
      </div>

      <div v-if="updateAvailable" class="status-card" style="background:var(--amber-soft);border-color:color-mix(in srgb,var(--amber),transparent 65%);color:var(--amber);margin-bottom:16px">
        <p style="margin:0">{{ updateMessage }}</p>
      </div>

      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" type="button" @click="runSetup" :disabled="setupRunning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ setupRunning ? 'Downloading...' : 'Download yt-dlp & ffmpeg' }}
        </button>
        <button class="btn btn-quiet" type="button" @click="openBinaryFolder" title="Open binary folder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
        </button>
      </div>
    </section>

    <section v-if="showProgress" class="panel panel-pad setup-progress">
      <div style="margin-bottom:16px">
        <div class="progress-meta"><strong>yt-dlp</strong><span>{{ ytdlpStatus }}</span></div>
        <div class="bar"><div class="bar-fill" :style="{width: ytdlpPercent+'%'}"></div></div>
        <p class="empty-copy" style="margin-top:6px">{{ ytdlpPercent }}%</p>
      </div>
      <div>
        <div class="progress-meta"><strong>ffmpeg</strong><span>{{ ffmpegStatus }}</span></div>
        <div class="bar"><div class="bar-fill" :style="{width: ffmpegPercent+'%'}"></div></div>
        <p class="empty-copy" style="margin-top:6px">{{ ffmpegPercent }}%</p>
      </div>
    </section>

    <div v-if="setupComplete" class="setup-complete">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      Setup complete. All dependencies are ready.
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const setupRunning = ref(false)
const showProgress = ref(false)
const setupComplete = ref(false)
const updateAvailable = ref(false)
const updateMessage = ref('')
const ytdlpStatus = ref('Waiting...')
const ffmpegStatus = ref('Waiting...')
const ytdlpPercent = ref(0)
const ffmpegPercent = ref(0)

let eventSource = null

async function checkUpdates() {
  try {
    const res = await fetch('/api/updates')
    if (res.ok) {
      const data = await res.json()
      if (data.ytDlp?.updateAvailable || data.ffmpeg?.updateAvailable) {
        updateAvailable.value = true
        const parts = []
        if (data.ytDlp?.updateAvailable) {
          parts.push(`yt-dlp ${data.ytDlp.latest} available`)
        }
        if (data.ffmpeg?.updateAvailable) {
          parts.push(`ffmpeg ${data.ffmpeg.latest} available`)
        }
        updateMessage.value = 'Update available: ' + parts.join(', ') + '.'
      }
    }
  } catch (e) {
    console.error('Setup update check error:', e)
  }
}

function runSetup() {
  setupRunning.value = true
  showProgress.value = true
  setupComplete.value = false
  ytdlpStatus.value = 'Starting...'
  ffmpegStatus.value = 'Waiting...'
  ytdlpPercent.value = 0
  ffmpegPercent.value = 0

  eventSource = new EventSource('/api/setup')

  eventSource.onmessage = (event) => {
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
        finishSetup()
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  eventSource.onerror = () => {
    console.error('SSE connection error')
    finishSetup()
  }
}

function finishSetup() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  setupRunning.value = false
  setupComplete.value = true
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

onMounted(() => {
  checkUpdates()
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})
</script>

<style scoped>
.setup-progress { margin-top: 18px; }
.progress-meta { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.bar { height: 8px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--brand); border-radius: 999px; transition: width 0.3s ease; }
.setup-complete { margin-top: 18px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--green); }
.status-card { padding: 12px 16px; border-radius: var(--radius); border: 1px solid; font-size: 13px; }
</style>
