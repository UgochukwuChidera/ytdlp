<template>
  <main class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Subscriptions</div>
        <h1>Subscriptions and batches.</h1>
        <p class="lede">Save channels, browse videos, shorts, and streams, then queue selected items together.</p>
      </div>
    </div>

    <section class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 1 0-8 0m12 8a8 8 0 0 0-16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <h2 style="margin:0">Subscribed Channels</h2>
      </div>

      <div class="subscribe-bar">
        <input type="text" v-model="channelUrl" placeholder="https://www.youtube.com/@ChannelName" @keyup.enter="subscribe">
        <button class="btn btn-primary" type="button" @click="subscribe" :disabled="subscribing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Subscribe
        </button>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <p>Loading channels...</p>
      </div>

      <div v-else-if="channels.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5"><path d="M16 11a4 4 0 1 0-8 0m12 8a8 8 0 0 0-16 0"/></svg>
        </div>
        <p class="empty-title">No channels subscribed yet</p>
        <p class="empty-copy">Enter a channel URL above to get started.</p>
      </div>

      <div v-else class="channels-grid">
        <div v-for="ch in channels" :key="ch.id" class="channel-card tilt-card" @click="selectChannel(ch)">
          <div class="channel-avatar">
            <img v-if="ch.avatar" :src="ch.avatar" :alt="ch.name" referrerpolicy="no-referrer">
            <div v-else class="channel-avatar-placeholder">{{ (ch.name || '?')[0] }}</div>
          </div>
          <div class="channel-info">
            <h3>{{ ch.name || ch.id }}</h3>
            <p v-if="ch.subscriberCount" class="channel-meta">{{ formatNumber(ch.subscriberCount) }} subscribers</p>
          </div>
          <button class="btn-unsubscribe" type="button" @click.stop="unsubscribe(ch)">Unsubscribe</button>
        </div>
      </div>
    </section>

    <section v-if="selectedChannel" class="panel panel-pad">
      <div class="section-title" style="justify-content:space-between">
        <h2 style="margin:0">{{ selectedChannel.name || selectedChannel.id }} Videos</h2>
        <button class="btn btn-primary" type="button" @click="downloadSelected" :disabled="selectedVideos.length === 0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Selected ({{ selectedVideos.length }})
        </button>
      </div>

      <div v-if="channelVideosLoading" class="loading-state">
        <div class="loader"></div>
        <p>Loading videos...</p>
      </div>

      <div v-else-if="channelVideos.length === 0" class="empty-state" style="min-height:120px">
        <p class="empty-copy">No videos found for this channel.</p>
      </div>

      <div v-else class="videos-grid">
        <div
          v-for="(video, idx) in channelVideos"
          :key="video.id || video.url || idx"
          class="video-card"
          :class="{ selected: isSelected(video) }"
          @click="toggleSelect(video)"
        >
          <div class="video-thumb">
            <img v-if="videoThumb(video)" :src="videoThumb(video)" :alt="video.title" referrerpolicy="no-referrer">
            <div v-else class="video-thumb-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--faint)"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span class="duration-badge">{{ formatDuration(video.duration) }}</span>
            <span v-if="video.type" class="type-badge" :class="'type-' + video.type">{{ video.type }}</span>
            <div class="select-overlay" :class="{ selected: isSelected(video) }">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="video-info">
            <h4 class="line-clamp-2">{{ video.title }}</h4>
            <p class="video-meta">
              {{ video.uploaded ? formatDate(video.uploaded) : '' }}{{ video.viewCount ? ' · ' + formatNumber(video.viewCount) + ' views' : '' }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from '../composables/useToast'
import { useDialog } from '../composables/useDialog'

const { showToast } = useToast()
const { confirmDialog } = useDialog()

const channels = ref([])
const channelUrl = ref('')
const loading = ref(true)
const subscribing = ref(false)
const selectedChannel = ref(null)
const channelVideos = ref([])
const channelVideosLoading = ref(false)
const selectedVideos = ref([])

async function loadChannels() {
  loading.value = true
  try {
    const res = await fetch('/api/channels')
    if (res.ok) {
      const data = await res.json()
      // Backend returns { channels: [...] }
      channels.value = Array.isArray(data.channels) ? data.channels : (Array.isArray(data) ? data : [])
    }
  } catch (e) {
    console.error('Channels load error:', e)
  } finally {
    loading.value = false
  }
}

async function subscribe() {
  const url = channelUrl.value.trim()
  if (!url) return
  subscribing.value = true
  try {
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      showToast('Channel subscribed!', 'success')
      channelUrl.value = ''
      await loadChannels()
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Failed to subscribe', 'error')
    }
  } catch (e) {
    showToast('Failed to subscribe: ' + e.message, 'error')
  } finally {
    subscribing.value = false
  }
}

async function unsubscribe(ch) {
  const ok = await confirmDialog({
    title: 'Unsubscribe?',
    message: `Unsubscribe from "${ch.name || ch.id}"?`,
    confirmLabel: 'Unsubscribe',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(ch.id)}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Unsubscribed', 'success')
      channels.value = channels.value.filter(c => c.id !== ch.id)
      if (selectedChannel.value?.id === ch.id) {
        selectedChannel.value = null
        channelVideos.value = []
        selectedVideos.value = []
      }
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Failed to unsubscribe', 'error')
    }
  } catch (e) {
    showToast('Failed to unsubscribe: ' + e.message, 'error')
  }
}

async function selectChannel(ch) {
  selectedChannel.value = ch
  selectedVideos.value = []
  channelVideos.value = []
  channelVideosLoading.value = true
  try {
    // Use the dedicated scrape endpoint for channels
    const res = await fetch(`/api/channels/${encodeURIComponent(ch.id)}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (res.ok) {
      const data = await res.json()
      // Backend returns { results: [...] }
      channelVideos.value = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : [])
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Failed to load videos', 'error')
      channelVideos.value = []
    }
  } catch (e) {
    console.error('Channel videos error:', e)
    showToast('Failed to load videos: ' + e.message, 'error')
    channelVideos.value = []
  } finally {
    channelVideosLoading.value = false
  }
}

function videoThumb(video) {
  // Scraped entries may lack thumbnails — construct from YouTube video ID
  if (video.thumbnail) return video.thumbnail
  const vid = video.id || (video.url ? extractVideoId(video.url) : null)
  if (vid) return `https://img.youtube.com/vi/${vid}/mqdefault.jpg`
  return null
}

function extractVideoId(url) {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function isSelected(video) {
  return selectedVideos.value.some(v => (v.id || v.url) === (video.id || video.url))
}

function toggleSelect(video) {
  const id = video.id || video.url
  const idx = selectedVideos.value.findIndex(v => (v.id || v.url) === id)
  if (idx >= 0) {
    selectedVideos.value.splice(idx, 1)
  } else {
    selectedVideos.value.push(video)
  }
}

async function downloadSelected() {
  const videos = selectedVideos.value
  if (videos.length === 0) return

  // Use batch endpoint for efficiency
  const urls = videos.map(v => v.url || v.webpage_url).filter(Boolean)
  if (urls.length === 0) {
    showToast('No valid video URLs to queue', 'error')
    return
  }

  try {
    const res = await fetch('/api/download/queue/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        titles: videos.map(v => v.title || v.name || v.url || v.webpage_url).filter(Boolean),
        title: selectedChannel.value?.name || 'Channel Videos',
      }),
    })
    if (res.ok) {
      const result = await res.json()
      const count = result.count || urls.length
      showToast(`Queued ${count} of ${urls.length} videos`, 'success')
      selectedVideos.value = []
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Failed to queue downloads', 'error')
    }
  } catch (e) {
    // Fallback: queue individually
    let queued = 0
    for (const video of videos) {
      try {
        const r = await fetch('/api/download/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: video.url || video.webpage_url,
            title: video.title || '',
          }),
        })
        if (r.ok) queued++
      } catch {}
    }
    showToast(`Queued ${queued} of ${videos.length} videos`, queued > 0 ? 'success' : 'error')
    selectedVideos.value = []
  }
}

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  // Handle YYYYMMDD format from yt-dlp
  if (/^\d{8}$/.test(dateStr)) {
    const d = new Date(dateStr.slice(0, 4), parseInt(dateStr.slice(4, 6)) - 1, dateStr.slice(6, 8))
    if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNumber(n) {
  if (n == null || n === '') return ''
  const num = Number(n)
  if (isNaN(num)) return ''
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

onMounted(() => {
  loadChannels()
})
</script>

<style scoped>
.subscribe-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 18px;
}
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.channel-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}
.channel-card:hover {
  border-color: var(--line);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}
.channel-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}
.channel-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.channel-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 20px;
  font-weight: 800;
}
.channel-info {
  flex: 1;
  min-width: 0;
}
.channel-info h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 720;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.channel-meta {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
.btn-unsubscribe {
  padding: 6px 12px;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  background: transparent;
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 140ms ease;
}
.btn-unsubscribe:hover {
  background: var(--red-soft);
}
.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.video-card {
  border: 1px solid var(--line);
  border-radius: 13px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}
.video-card:hover {
  border-color: var(--line);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}
.video-card.selected {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}
.video-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface-3);
  overflow: hidden;
}
.video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.video-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-3);
  color: var(--faint);
}
.duration-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(17,24,39,0.82);
  color: #fff;
  font-size: 11px;
  font-weight: 720;
}
.type-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 3px 7px;
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 720;
  text-transform: uppercase;
}
.type-badge.type-video { background: rgba(37,99,235,0.86); }
.type-badge.type-short { background: rgba(236,72,153,0.86); }
.type-badge.type-stream { background: rgba(34,197,94,0.86); }
.select-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  opacity: 0;
  transition: opacity 140ms ease;
}
.video-card:hover .select-overlay {
  opacity: 1;
}
.select-overlay.selected {
  opacity: 1;
  background: rgba(37,99,235,0.3);
}
.select-overlay svg {
  color: #fff;
}
.video-info {
  padding: 12px;
}
.video-info h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 720;
  line-height: 1.35;
}
.video-meta {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Responsive */
@media (max-width: 680px) {
  .subscribe-bar {
    grid-template-columns: 1fr;
  }
  .channels-grid {
    grid-template-columns: 1fr;
  }
  .videos-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
