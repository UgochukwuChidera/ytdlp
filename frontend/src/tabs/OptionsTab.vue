<template>
  <main class="page page-narrow">
    <div class="page-head">
      <div>
        <div class="eyebrow">Options</div>
        <h1>App settings.</h1>
        <p class="lede">Configure download directory, theme, and default preferences.</p>
      </div>
    </div>

    <section class="panel panel-pad">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 17h2m6 0h8M10 5v4M8 15v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <h2 style="margin:0">Settings</h2>
      </div>

      <div class="field-grid">
        <div class="field">
          <label for="optDownloadDir">Download Directory</label>
          <input type="text" id="optDownloadDir" v-model="options.downloadDir" placeholder="~/Downloads/yt-dlp">
        </div>
        <div class="field">
          <label for="optTheme">Theme</label>
          <select id="optTheme" v-model="options.theme">
            <option value="auto">Auto (System)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        <div class="field">
          <label for="optDefaultFormat">Default Format</label>
          <select id="optDefaultFormat" v-model="options.defaultFormat">
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </div>
        <div class="field">
          <label for="optDefaultQuality">Default Quality</label>
          <select id="optDefaultQuality" v-model="options.defaultQuality">
            <option value="best">Best Available</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
      </div>

      <div style="margin-top:20px;display:flex;gap:12px">
        <button class="btn btn-primary" type="button" @click="saveOptions">Save Settings</button>
        <button class="btn" type="button" @click="resetOptions">Reset to Defaults</button>
      </div>

      <div v-if="saved" class="saved-notice">Settings saved successfully.</div>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useToast } from '../composables/useToast'

const { showToast } = useToast()

const options = reactive({
  downloadDir: '',
  theme: 'auto',
  defaultFormat: 'mp4',
  defaultQuality: 'best',
})
const saved = ref(false)

async function loadOptions() {
  try {
    const res = await fetch('/api/options')
    if (res.ok) {
      const data = await res.json()
      // Merge server response into local options (gracefully handles unknown fields)
      if (data && typeof data === 'object') {
        for (const key of Object.keys(options)) {
          if (data[key] !== undefined) {
            options[key] = data[key]
          }
        }
      }
    }
  } catch (e) {
    console.error('Load options error:', e)
  }
}

async function saveOptions() {
  try {
    const res = await fetch('/api/options/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { ...options } }),
    })
    if (res.ok) {
      saved.value = true
      showToast('Settings saved', 'success')
      setTimeout(() => { saved.value = false }, 3000)
    } else {
      const body = await res.json().catch(() => ({}))
      showToast(body.error || 'Failed to save settings', 'error')
    }
  } catch (e) {
    showToast('Failed to save settings: ' + e.message, 'error')
  }
}

async function resetOptions() {
  options.downloadDir = ''
  options.theme = 'auto'
  options.defaultFormat = 'mp4'
  options.defaultQuality = 'best'
  try {
    await fetch('/api/options/reset', { method: 'POST' })
    showToast('Options reset to defaults', 'info')
  } catch (e) {
    console.error('Options reset error:', e)
  }
}

onMounted(() => {
  loadOptions()
})
</script>

<style scoped>
.saved-notice {
  margin-top: 16px;
  padding: 10px 14px;
  background: var(--green-soft);
  color: var(--green);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
</style>
