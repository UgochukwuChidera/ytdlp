<template>
  <div class="app-shell">
    <!-- Mobile sidebar overlay -->
    <div
      class="sidebar-overlay"
      :class="{ open: mobileSidebarOpen }"
      @click="mobileSidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: mobileSidebarOpen, collapsed: sidebarCollapsed }">
      <div class="brand">
        <button
          class="brand-mark brand-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-expanded="sidebarCollapsed ? 'false' : 'true'"
          :data-tooltip="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleCollapse"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="brand-text">
          <div class="brand-title">YT-DLP</div>
          <div class="brand-subtitle">Web Interface</div>
        </div>
      </div>

      <nav class="side-nav" aria-label="Primary">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="tab-btn"
          :class="{ 'tab-active': isActive(item.path) }"
          :data-tooltip="item.label"
          :aria-label="item.label"
          @click="mobileSidebarOpen = false"
        >
          <span class="tab-icon" v-html="item.icon"></span>
          <span class="tab-label">{{ item.label }}</span>
          <span v-if="item.badgeKey === 'active' && activeCount > 0" class="nav-badge">{{ activeCount }}</span>
          <span v-if="item.badgeKey === 'binaries' && binariesMissing" class="nav-dot"></span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button class="tab-btn" type="button" aria-label="Toggle dark mode" :data-tooltip="isDark ? 'Dark' : 'Light'" @click="toggleDarkMode">
          <span class="tab-icon">
            <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 14.5A8 8 0 0 1 9.5 3 9 9 0 1 0 21 14.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v1m0 14v1m8-8h-1M5 12H4m13.7-5.7-.7.7M7 17l-.7.7m11.4 0-.7-.7M7 7l-.7-.7M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="tab-label">{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main-content" :class="{ collapsed: sidebarCollapsed }">
      <div class="mobile-topbar">
        <button class="hamburger" :class="{ open: mobileSidebarOpen }" type="button" aria-label="Open navigation" @click="mobileSidebarOpen = !mobileSidebarOpen">
          <span class="hamburger-lines"></span>
        </button>
        <div class="brand-mark" style="width:32px;height:32px">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <strong>YT-DLP</strong>
      </div>

      <router-view />

      <footer>
        <span>YT-DLP Web Interface</span>
      </footer>
    </div>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Toast from './components/Toast.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const route = useRoute()

const mobileSidebarOpen = ref(false)
const isDark = ref(true)

// Desktop sidebar collapse (icon rail), remembered across sessions.
const sidebarCollapsed = ref(localStorage.getItem('sidebarCollapsed') === 'true')
function toggleCollapse() {
  // The icon rail only exists on desktop; on mobile the logo has no collapse
  // meaning, so don't flip (and persist) the desktop preference.
  if (window.matchMedia('(max-width: 860px)').matches) return
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value ? 'true' : 'false')
}

// Live counters for nav badges.
const activeCount = ref(0)
const binariesMissing = ref(false)

const navItems = [
  {
    path: '/download',
    label: 'Download',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    path: '/library',
    label: 'Library',
    badgeKey: 'active',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  },
  {
    path: '/subscriptions',
    label: 'Subscriptions',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 1 0-8 0m12 8a8 8 0 0 0-16 0m15-8a3 3 0 0 1 3 3m-20 0a3 3 0 0 1 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  {
    path: '/settings',
    label: 'Settings',
    badgeKey: 'binaries',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 17h2m6 0h8M10 5v4M8 15v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
]

function isActive(path) {
  return route.path === path
}

function toggleDarkMode() {
  isDark.value = !isDark.value
}

function applyDarkMode(dark) {
  document.documentElement.classList.toggle('dark', dark)
}

onMounted(() => {
  // Restore dark mode
  const darkMode = localStorage.getItem('darkMode')
  isDark.value = darkMode !== 'false'
  applyDarkMode(isDark.value)

  // Initial badge state, then poll queue activity every 5s.
  refreshBadges()
  badgeTimer = setInterval(refreshBadges, 5000)
})

let badgeTimer = null

async function refreshBadges() {
  try {
    const [queueRes, statusRes] = await Promise.all([
      fetch('/api/download/queue'),
      fetch('/api/status'),
    ])
    if (queueRes.ok) {
      const data = await queueRes.json()
      const jobs = Array.isArray(data.jobs) ? data.jobs : []
      activeCount.value = jobs.filter(j => ['queued', 'downloading', 'paused'].includes(j.status || 'queued')).length
    }
    if (statusRes.ok) {
      const status = await statusRes.json()
      binariesMissing.value = Array.isArray(status.binaries) &&
        status.binaries.some(b => b.name !== 'ffprobe' && !b.exists)
    }
  } catch {
    // Server briefly unreachable — keep previous values; the timer retries.
  }
}

onUnmounted(() => {
  if (badgeTimer) {
    clearInterval(badgeTimer)
    badgeTimer = null
  }
})

watch(isDark, (val) => {
  localStorage.setItem('darkMode', val ? 'true' : 'false')
  applyDarkMode(val)
})
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
}

/* ===== SIDEBAR ===== */
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 60;
  width: var(--sidebar);
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg), var(--surface) 30%);
  border-right: 1px solid var(--line);
  box-shadow: 2px 0 0 rgba(255, 255, 255, 0.22);
}
html.dark .sidebar {
  background: color-mix(in srgb, var(--surface), var(--bg) 28%);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 76px;
  padding: 20px 18px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.brand-mark {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: var(--accent);
  border: 1px solid var(--line);
  border-radius: 10px;
  color: #241d28;
  box-shadow: 0 3px 0 var(--line);
  flex-shrink: 0;
}

/* The download icon doubles as the collapse/expand control. */
.brand-toggle {
  position: relative;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.brand-toggle:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 0 var(--line);
}
.brand-toggle:active {
  transform: translateY(1px);
  box-shadow: 0 2px 0 var(--line);
}
.brand-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--brand-soft), 0 3px 0 var(--line);
}

.brand-text {
  flex: 1;
  min-width: 0;
}

.brand-title {
  font-size: 16px;
  font-weight: 850;
  letter-spacing: -0.045em;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.side-nav {
  flex: 1;
  overflow-y: auto;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tab-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 9px 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: none;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  white-space: nowrap;
  width: 100%;
  text-align: left;
}

.tab-btn:hover {
  background: var(--surface);
  border-color: var(--line-soft);
  color: var(--text);
}

.tab-btn.tab-active {
  background: var(--surface);
  border-color: var(--line);
  color: var(--text);
  box-shadow: 0 2px 0 var(--line);
}

.tab-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 8px;
}

.tab-label {
  transition: opacity 0.15s ease;
  overflow: hidden;
}

.sidebar-footer {
  padding: 10px 8px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}

/* ===== NAV BADGES ===== */
.nav-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  border: 1px solid var(--line);
  color: #241d28;
  font-size: 10px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.nav-dot {
  margin-left: auto;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--red);
  flex-shrink: 0;
}

/* ===== COLLAPSED SIDEBAR (desktop icon rail) ===== */
.sidebar.collapsed {
  width: var(--sidebar-collapsed);
}
.sidebar.collapsed .brand {
  flex-direction: row;
  justify-content: center;
  gap: 4px;
  padding: 20px 4px;
}
.sidebar.collapsed .brand-text,
.sidebar.collapsed .tab-label {
  display: none;
}
.sidebar.collapsed .side-nav {
  padding: 14px 10px;
  overflow: visible;
}
.sidebar.collapsed .tab-btn {
  justify-content: center;
  gap: 0;
  padding: 10px 0;
}
.sidebar.collapsed .tab-icon {
  width: 28px;
  height: 28px;
}
.sidebar.collapsed .nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin: 0;
  font-size: 9px;
}
.sidebar.collapsed .nav-dot {
  position: absolute;
  top: 9px;
  right: 9px;
  margin: 0;
}
.sidebar.collapsed .sidebar-footer .tab-btn {
  justify-content: center;
  padding: 10px 0;
}

/* Icon-rail tooltips replace native title tooltips. */
.sidebar.collapsed .tab-btn[data-tooltip]::after,
.sidebar.collapsed .brand-toggle[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  z-index: 200;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--text);
  color: var(--surface);
  box-shadow: var(--shadow-soft);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(-4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.sidebar.collapsed .tab-btn[data-tooltip]:hover::after,
.sidebar.collapsed .tab-btn[data-tooltip]:focus-visible::after,
.sidebar.collapsed .brand-toggle[data-tooltip]:hover::after,
.sidebar.collapsed .brand-toggle[data-tooltip]:focus-visible::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

/* ===== SIDEBAR OVERLAY (mobile) ===== */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 55;
  background: rgba(0,0,0,0.4);
}

.sidebar-overlay.open {
  display: block;
}

/* ===== MAIN CONTENT ===== */
.main-content {
  margin-left: var(--sidebar);
  flex: 1;
  min-width: 0;
  transition: margin-left 0.18s ease;
}
.main-content.collapsed {
  margin-left: var(--sidebar-collapsed);
}

/* ===== MOBILE TOPBAR ===== */
.mobile-topbar {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 860px) {
  .sidebar {
    transform: translateX(-100%);
    width: 272px !important;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .sidebar.collapsed .brand {
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
    padding: 20px 18px;
  }
  .sidebar.collapsed .brand-text,
  .sidebar.collapsed .tab-label {
    display: revert;
  }
  .sidebar.collapsed .tab-btn {
    justify-content: flex-start;
    gap: 10px;
    padding: 9px 11px;
  }
  .sidebar.collapsed .tab-icon {
    width: 24px;
    height: 24px;
  }
  .sidebar.collapsed .nav-badge,
  .sidebar.collapsed .nav-dot {
    position: static;
    margin-left: auto;
  }
  .sidebar.collapsed .tab-btn[data-tooltip]::after,
  .sidebar.collapsed .brand-toggle[data-tooltip]::after {
    display: none;
  }
  .main-content {
    margin-left: 0 !important;
  }
  .mobile-topbar {
    display: flex;
  }
}
</style>
