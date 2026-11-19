import { ref } from 'vue'

// Module-level state: survives route changes, so returning to the Library tab
// paints immediately with the last known data while a refresh runs in the
// background. This is what makes a finished download appear without a reload.
const jobs = ref([])
const files = ref([])
const queueLoading = ref(true)
const filesLoading = ref(true)
const filesError = ref('')
const lastQueueSync = ref(0)
const lastFilesSync = ref(0)

let eventSource = null
let fileRefreshTimer = null
let pollTimer = null

function setJobs(nextJobs) {
  jobs.value = Array.isArray(nextJobs) ? nextJobs : []
  lastQueueSync.value = Date.now()
}

async function fetchQueue() {
  queueLoading.value = true
  try {
    const res = await fetch('/api/download/queue')
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()
    setJobs(data.jobs)
  } catch (error) {
    console.error('Queue fetch error:', error)
  } finally {
    queueLoading.value = false
  }
}

async function fetchFiles() {
  filesLoading.value = true
  try {
    const res = await fetch('/api/files')
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()
    files.value = Array.isArray(data) ? data : []
    filesError.value = ''
    lastFilesSync.value = Date.now()
  } catch (error) {
    filesError.value = error.message
  } finally {
    filesLoading.value = false
  }
}

// A completed/failed job means the downloads folder likely changed. Coalesce
// bursts of updates into one fetch so a large batch doesn't hammer the server.
function scheduleFilesRefresh(delay = 600) {
  if (fileRefreshTimer) clearTimeout(fileRefreshTimer)
  fileRefreshTimer = setTimeout(() => {
    fileRefreshTimer = null
    fetchFiles()
  }, delay)
}

function applyJobUpdate(update) {
  if (!update) return
  const jobId = update.id || update._id
  const idx = jobs.value.findIndex(j => (j.id || j._id) === jobId)

  if (update.status === 'removed') {
    if (idx >= 0) {
      jobs.value.splice(idx, 1)
      jobs.value = [...jobs.value]
    }
    return
  }

  if (idx >= 0) {
    jobs.value[idx] = { ...jobs.value[idx], ...update }
    jobs.value = [...jobs.value]
  } else {
    jobs.value.push(update)
  }

  if (update.status === 'completed' || update.status === 'failed') {
    scheduleFilesRefresh()
  }
}

function connectSSE() {
  if (eventSource || typeof EventSource === 'undefined') return

  eventSource = new EventSource('/api/download/queue/events')

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'init' && Array.isArray(data.jobs)) {
        setJobs(data.jobs)
        return
      }
      if (data.type === 'update' && data.job) {
        applyJobUpdate(data.job)
        return
      }
      if (Array.isArray(data)) {
        setJobs(data)
        return
      }
      if (Array.isArray(data.jobs)) {
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error('Queue SSE parse error:', error)
    }
  }

  eventSource.onerror = () => {
    // EventSource reconnects automatically; keep the cached state meanwhile.
  }
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

// Called when the Library tab mounts. Revalidates immediately (so a job that
// finished while another tab was open shows up) and keeps polling files.
function start() {
  connectSSE()
  fetchQueue()
  fetchFiles()

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchFiles()
    }, 15000)
  }
}

function stop() {
  disconnectSSE()
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (fileRefreshTimer) {
    clearTimeout(fileRefreshTimer)
    fileRefreshTimer = null
  }
}

function refreshAll() {
  fetchQueue()
  fetchFiles()
}

function patchFiles(updater) {
  files.value = typeof updater === 'function' ? updater(files.value) : updater
  lastFilesSync.value = Date.now()
}

export function useLibrary() {
  return {
    jobs,
    files,
    queueLoading,
    filesLoading,
    filesError,
    lastQueueSync,
    lastFilesSync,
    start,
    stop,
    refreshAll,
    fetchQueue,
    fetchFiles,
    patchFiles,
  }
}
