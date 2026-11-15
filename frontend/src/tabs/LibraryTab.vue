<template>
  <main class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Library</div>
        <h1>Downloads at a glance.</h1>
        <p class="lede">Track active jobs, pause or cancel them, and manage the files already on disk.</p>
      </div>
    </div>

    <!-- Segmented control: Active / Ready -->
    <div class="lib-segmented" role="tablist" aria-label="Library sections">
      <button
        type="button"
        role="tab"
        class="lib-segment"
        :class="{ active: view === 'active' }"
        :aria-selected="view === 'active'"
        @click="view = 'active'"
      >
        Active
        <span class="lib-count">{{ activeCount }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="lib-segment"
        :class="{ active: view === 'ready' }"
        :aria-selected="view === 'ready'"
        @click="view = 'ready'"
      >
        Ready
        <span class="lib-count">{{ files.length }}</span>
      </button>
    </div>

    <!-- ============ ACTIVE (queue) ============ -->
    <section v-show="view === 'active'" class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <h2 style="margin:0">Jobs</h2>
        <div class="filter-bar" style="margin-left:auto">
          <button
            v-for="s in statusFilters"
            :key="s.value"
            class="queue-filter-btn"
            :class="{ active: activeFilter === s.value }"
            @click="activeFilter = s.value"
          >{{ s.label }}</button>
        </div>
      </div>

      <!-- Bulk actions -->
      <div class="queue-controls" style="margin-bottom:16px">
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" @click="startAllJobs" title="Start all queued jobs now">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Start All
          </button>
          <button class="btn btn-sm btn-warning" @click="cancelAllJobs" title="Cancel all queued and downloading jobs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Cancel All
          </button>
          <button class="btn btn-sm btn-quiet" @click="clearCompleted" title="Remove all completed jobs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Clear Completed
          </button>
          <button class="btn btn-sm btn-quiet" @click="clearFailed" title="Remove all failed jobs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear Failed
          </button>
          <button class="btn btn-sm btn-danger" @click="clearAll" title="Remove all jobs from the queue">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Clear All
          </button>
        </div>
      </div>

      <div v-if="loading && jobs.length === 0" class="loading-state">
        <div class="loader"></div>
        <p>Loading queue...</p>
      </div>

      <div v-else-if="filteredJobs.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
        </div>
        <p class="empty-title">{{ activeFilter === 'all' ? 'No jobs in queue' : `No ${activeFilter} jobs` }}</p>
        <p class="empty-copy">Downloads appear here when started.</p>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Progress</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in filteredJobs" :key="job.id || job.url">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium max-w-xs truncate" :title="job.title || job.filename || job.url">
                {{ job.title || job.filename || job.url }}
              </td>
              <td>
                <span class="status-badge" :class="job.status || 'queued'">{{ job.status || 'queued' }}</span>
              </td>
              <td>
                <div class="progress-cell">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :class="progressClass(job)"
                      :style="{ width: progressWidth(job) + '%' }"
                    ></div>
                  </div>
                  <span class="progress-text">{{ progressText(job) }}</span>
                </div>
              </td>
              <td class="actions-cell">
                <button
                  v-if="job.status === 'queued'"
                  class="btn btn-xs btn-primary"
                  @click="startAllJobs"
                  title="Start job"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Start
                </button>
                <button
                  v-if="job.status === 'downloading'"
                  class="btn btn-xs btn-warning"
                  @click="pauseJob(job)"
                  title="Pause job"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Pause
                </button>
                <button
                  v-if="job.status === 'paused'"
                  class="btn btn-xs btn-primary"
                  @click="resumeJob(job)"
                  title="Resume job"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Resume
                </button>
                <button
                  v-if="job.error && job.status === 'failed'"
                  class="btn btn-xs btn-danger"
                  @click="copyError(job)"
                  title="Click to copy error message"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Error
                </button>
                <button
                  class="btn btn-xs btn-danger"
                  @click="removeJob(job)"
                  title="Remove job"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ============ READY (files on disk) ============ -->
    <section v-show="view === 'ready'" class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <h2 style="margin:0">Downloaded Files</h2>
        <button class="btn btn-quiet" type="button" style="margin-left:auto" title="Open downloads folder" @click="openDownloadsFolder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
        </button>
      </div>
      <div class="field" style="margin-bottom:16px">
        <input type="text" v-model="search" placeholder="Search downloaded files..." autocomplete="off" style="width:100%">
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Date</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in filteredFiles" :key="file.name">
              <td>{{ file.name }}</td>
              <td>{{ formatSize(file.size) }}</td>
              <td>{{ formatDate(file.created) }}</td>
              <td style="text-align:right">
                <div class="dropdown-container" @click.stop>
                  <button class="dropdown-trigger" type="button" @click="toggleDropdown(file.name)" title="More actions">...</button>
                  <div class="dropdown-menu" :class="{ open: openDropdown === file.name }">
                    <button class="dropdown-item" type="button" @click="openFile(file.name)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Open
                    </button>
                    <a class="dropdown-item" :href="`/api/files/${encodeURIComponent(file.name)}`" download>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Save to device
                    </a>
                    <button class="dropdown-item danger" type="button" @click="deleteFile(file.name)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Delete
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filesError" class="empty-state">
        <p class="empty-title">Failed to load files</p>
        <p class="empty-copy">{{ filesError }}</p>
      </div>
      <div v-else-if="filteredFiles.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" style="opacity:0.5"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
        </div>
        <p class="empty-title">{{ search ? 'No matching files' : 'No downloads yet' }}</p>
        <p class="empty-copy">Completed downloads appear here.</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDialog } from '../composables/useDialog'

const { confirmDialog } = useDialog()

// ── Shared view state ──
const view = ref('active')

// ══════════════ QUEUE (Active) ══════════════
const jobs = ref([])
const loading = ref(true)
const activeFilter = ref('all')

const statusFilters = [
  { label: 'All', value: 'all' },
  { label: 'Queued', value: 'queued' },
  { label: 'Downloading', value: 'downloading' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
]

const filteredJobs = computed(() => {
  if (activeFilter.value === 'all') return jobs.value
  return jobs.value.filter(j => (j.status || 'queued') === activeFilter.value)
})

const activeCount = computed(() =>
  jobs.value.filter(j => ['queued', 'downloading', 'paused'].includes(j.status || 'queued')).length
)

// SSE connection
let eventSource = null

function connectSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }

  eventSource = new EventSource('/api/download/queue/events')

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      // SSE sends { type: 'init', jobs: [...] } on connect
      if (data.type === 'init' && Array.isArray(data.jobs)) {
        jobs.value = data.jobs
        loading.value = false
        return
      }

      // SSE sends { type: 'update', job: {...} } on progress/status change
      if (data.type === 'update' && data.job) {
        const jobId = data.job.id || data.job._id
        const idx = jobs.value.findIndex(j => (j.id || j._id) === jobId)
        // The server deletes the job before emitting status 'removed' —
        // splicing keeps deleted rows from re-materializing as phantoms.
        if (data.job.status === 'removed') {
          if (idx >= 0) {
            jobs.value.splice(idx, 1)
            jobs.value = [...jobs.value]
          }
          return
        }
        if (idx >= 0) {
          jobs.value[idx] = { ...jobs.value[idx], ...data.job }
          // Trigger reactivity by replacing the array
          jobs.value = [...jobs.value]
        } else {
          jobs.value.push(data.job)
        }
        return
      }

      // Fallback: raw array
      if (Array.isArray(data)) {
        jobs.value = data
        loading.value = false
        return
      }

      // Fallback: { jobs: [...] }
      if (Array.isArray(data.jobs)) {
        jobs.value = data.jobs
        loading.value = false
        return
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  eventSource.onerror = () => {
    // Browser EventSource will auto-reconnect
  }
}

// Progress helpers
function progressWidth(job) {
  if (!job || job.status === 'completed') return 100
  if (job.status === 'failed') return 100
  return Math.min(job.progress || 0, 100)
}

function progressText(job) {
  if (!job) return '0%'
  if (job.status === 'completed') return '100%'
  if (job.status === 'failed') return 'Failed'
  return Math.round(job.progress || 0) + '%'
}

function progressClass(job) {
  if (!job) return ''
  if (job.status === 'completed') return 'fill-completed'
  if (job.status === 'failed') return 'fill-failed'
  return 'fill-active'
}

// API calls
const apiBase = ''

async function fetchQueue() {
  try {
    const res = await fetch(apiBase + '/api/download/queue')
    if (res.ok) {
      const data = await res.json()
      // Backend returns { jobs: [...] }
      jobs.value = Array.isArray(data.jobs) ? data.jobs : []
    }
  } catch (e) {
    console.error('Queue fetch error:', e)
  } finally {
    loading.value = false
  }
}

// --- Bulk actions ---
async function startAllJobs() {
  try {
    const res = await fetch(apiBase + '/api/download/queue/start-all', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to start jobs')
  } catch (e) {
    console.error('Start all error:', e)
  }
}

async function cancelAllJobs() {
  const ok = await confirmDialog({
    title: 'Cancel all jobs?',
    message: 'Cancel all queued and downloading jobs? Downloading jobs will be paused and can be resumed.',
    confirmLabel: 'Cancel All',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await fetch(apiBase + '/api/download/queue/cancel-all', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to cancel jobs')
  } catch (e) {
    console.error('Cancel all error:', e)
  }
}

async function clearCompleted() {
  try {
    const res = await fetch(apiBase + '/api/download/queue/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (!res.ok) throw new Error('Failed to clear completed')
  } catch (e) {
    console.error('Clear completed error:', e)
  }
}

async function clearFailed() {
  try {
    const res = await fetch(apiBase + '/api/download/queue/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed' }),
    })
    if (!res.ok) throw new Error('Failed to clear failed')
  } catch (e) {
    console.error('Clear failed error:', e)
  }
}

async function clearAll() {
  const ok = await confirmDialog({
    title: 'Clear the queue?',
    message: 'Remove all jobs from the queue?',
    confirmLabel: 'Clear All',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await fetch(apiBase + '/api/download/queue/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'all' }),
    })
    if (!res.ok) throw new Error('Failed to clear queue')
  } catch (e) {
    console.error('Clear all error:', e)
  }
}

// --- Individual job actions ---
// Pause keeps the job in the queue (it can be resumed later) — unlike
// Remove, which deletes it entirely.
async function pauseJob(job) {
  const id = job.id || job._id
  if (!id) return
  try {
    const res = await fetch(apiBase + `/api/download/queue/cancel/${encodeURIComponent(id)}`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to pause job')
  } catch (e) {
    console.error('Pause job error:', e)
  }
}

async function resumeJob(job) {
  const id = job.id || job._id
  if (!id) return
  try {
    const res = await fetch(apiBase + `/api/download/queue/resume/${encodeURIComponent(id)}`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to resume job')
  } catch (e) {
    console.error('Resume job error:', e)
  }
}

async function removeJob(job) {
  const id = job.id || job._id
  if (!id) return
  const ok = await confirmDialog({
    title: 'Remove job?',
    message: 'Remove this job from the queue?',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await fetch(apiBase + `/api/download/queue/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to remove job')
    // Remove from local state immediately
    jobs.value = jobs.value.filter(j => (j.id || j._id) !== id)
  } catch (e) {
    console.error('Remove job error:', e)
  }
}

async function copyError(job) {
  if (!job.error) return
  try {
    await navigator.clipboard.writeText(job.error)
  } catch {
    // Fallback: select text approach
    const ta = document.createElement('textarea')
    ta.value = job.error
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// ══════════════ FILES (Ready) ══════════════
const files = ref([])
const openDropdown = ref(null)
const search = ref('')
const filesError = ref('')

const filteredFiles = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return files.value
  return files.value.filter(f => f.name.toLowerCase().includes(q))
})

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)
  return `${size} ${units[i]}`
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || 'Unknown'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toggleDropdown(name) {
  openDropdown.value = openDropdown.value === name ? null : name
}

function openFile(name) {
  fetch(`/api/open-file/${encodeURIComponent(name)}`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error('Failed to open file')
    })
    .catch(e => console.error('Open file error:', e))
  openDropdown.value = null
}

async function openDownloadsFolder() {
  try {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'downloads' }),
    })
  } catch (e) {
    console.error('Open folder error:', e)
  }
}

async function deleteFile(name) {
  const ok = await confirmDialog({
    title: 'Delete file?',
    message: `Delete "${name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete file')
    files.value = files.value.filter(f => f.name !== name)
  } catch (e) {
    console.error('Delete error:', e)
  }
  openDropdown.value = null
}

function handleClickOutside(e) {
  if (!e.target.closest('.dropdown-container')) {
    openDropdown.value = null
  }
}

async function fetchFiles() {
  try {
    const response = await fetch('/api/files')
    if (response.ok) {
      const data = await response.json()
      files.value = Array.isArray(data) ? data : []
    } else {
      filesError.value = `Server returned ${response.status}`
    }
  } catch (e) {
    filesError.value = e.message
  }
}

// ══════════════ Lifecycle ══════════════
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await fetchQueue()
  connectSSE()
  fetchFiles()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})
</script>

<style scoped>
/* ── Segmented control ── */
.lib-segmented {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-bottom: 16px;
}
.lib-segment {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 660;
  cursor: pointer;
  transition: all 140ms ease;
}
.lib-segment:hover {
  color: var(--text);
}
.lib-segment.active {
  background: var(--brand-soft);
  color: var(--brand);
}
.lib-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.lib-segment.active .lib-count {
  background: var(--brand);
  color: #fff;
}

/* ── Filter bar ── */
.filter-bar {
  display: flex;
  gap: 6px;
}
.queue-filter-btn {
  padding: 5px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 12px;
  font-weight: 660;
  cursor: pointer;
  transition: all 140ms ease;
  min-height: 30px;
  line-height: 1;
}
.queue-filter-btn:hover {
  border-color: var(--brand);
  color: var(--text);
}
.queue-filter-btn.active {
  background: var(--brand-soft);
  color: var(--brand);
  border-color: var(--brand);
}

/* ── Status badges ── */
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 720;
  text-transform: capitalize;
  letter-spacing: 0.02em;
}
.status-badge.queued {
  background: var(--amber-soft);
  color: var(--amber);
}
.status-badge.downloading {
  background: var(--blue-soft);
  color: var(--blue);
}
.status-badge.completed {
  background: var(--green-soft);
  color: var(--green);
}
.status-badge.failed {
  background: var(--red-soft);
  color: var(--red);
}
.status-badge.paused {
  background: var(--amber-soft);
  color: var(--amber);
}

/* ── Progress bar ── */
.progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--surface-3);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  background: linear-gradient(90deg, var(--brand), var(--brand-2));
}
.progress-fill.fill-completed {
  background: linear-gradient(90deg, var(--green), #34d399);
}
.progress-fill.fill-failed {
  background: linear-gradient(90deg, var(--red), #f87171);
}
.progress-text {
  font-size: 12px;
  color: var(--muted);
  min-width: 46px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Action buttons (smaller variants) ── */
.btn-sm {
  min-height: 32px;
  padding: 5px 11px;
  font-size: 12px;
  gap: 5px;
}
.btn-xs {
  min-height: 28px;
  padding: 3px 8px;
  font-size: 11px;
  gap: 4px;
  border-radius: 6px;
}
.btn-warning {
  color: var(--amber);
  border-color: color-mix(in srgb, var(--amber), transparent 65%);
  background: var(--amber-soft);
}
.btn-warning:hover {
  background: color-mix(in srgb, var(--amber-soft), black 5%);
  border-color: color-mix(in srgb, var(--amber), transparent 40%);
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

/* ── Actions cell ── */
.actions-cell {
  text-align: right;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}

/* ── Queue controls row ── */
.queue-controls .btn svg {
  flex-shrink: 0;
}

/* ── Loading state ── */
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
  animation: lib-spin 0.7s linear infinite;
  margin: 0 auto 12px;
}
@keyframes lib-spin {
  to { transform: rotate(360deg); }
}

/* ── Responsive tweaks ── */
@media (max-width: 860px) {
  .actions-cell {
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .progress-cell {
    min-width: 110px;
  }
}
</style>
