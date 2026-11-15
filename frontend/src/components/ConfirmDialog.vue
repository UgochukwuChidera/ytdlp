<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="dialog" class="dialog-overlay" @click.self="close(false)">
        <div class="dialog-card" role="dialog" aria-modal="true" :aria-label="dialog.title">
          <div class="dialog-icon" :class="{ danger: dialog.danger }">
            <svg v-if="dialog.danger" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>
          <h3 class="dialog-title">{{ dialog.title }}</h3>
          <p v-if="dialog.message" class="dialog-message">{{ dialog.message }}</p>
          <div class="dialog-actions">
            <button ref="cancelBtn" class="btn dialog-btn dialog-btn-quiet" type="button" @click="close(false)">
              {{ dialog.cancelLabel }}
            </button>
            <button ref="confirmBtn" class="btn dialog-btn" :class="dialog.danger ? 'dialog-btn-danger' : 'dialog-btn-primary'" type="button" @click="close(true)">
              {{ dialog.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useDialog } from '../composables/useDialog'

const { dialog, resolveDialog } = useDialog()
const confirmBtn = ref(null)
const cancelBtn = ref(null)

function close(result) {
  resolveDialog(result)
}

function onKeydown(e) {
  if (!dialog.value) return
  if (e.key === 'Escape') {
    close(false)
  } else if (e.key === 'Tab') {
    // Simple focus trap between the two buttons
    const order = [cancelBtn.value, confirmBtn.value]
    const idx = order.indexOf(document.activeElement)
    e.preventDefault()
    const next = e.shiftKey
      ? order[(idx - 1 + order.length) % order.length]
      : order[(idx + 1) % order.length]
    next?.focus()
  }
}

watch(dialog, async (d) => {
  if (d) {
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    // Focus the safe action by default: cancel for danger dialogs,
    // confirm otherwise.
    ;(d.danger ? cancelBtn : confirmBtn).value?.focus()
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  // If the component unmounts with a dialog open (HMR, route change), settle
  // the pending promise so awaiting callers never hang.
  resolveDialog(false)
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dialog-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
  width: 100%;
  max-width: 380px;
  padding: 22px;
  text-align: center;
}
.dialog-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  margin-bottom: 12px;
}
.dialog-icon.danger {
  background: var(--red-soft);
  color: var(--red);
}
.dialog-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 720;
  color: var(--text);
}
.dialog-message {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  word-break: break-word;
}
.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.dialog-btn {
  flex: 1;
  min-height: 36px;
  font-size: 13px;
  font-weight: 660;
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
}
.dialog-btn-quiet {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--muted);
}
.dialog-btn-quiet:hover {
  background: var(--surface-3);
  color: var(--text);
}
.dialog-btn-primary {
  background: var(--brand);
  border: 1px solid var(--brand);
  color: #fff;
}
.dialog-btn-primary:hover {
  filter: brightness(1.1);
}
.dialog-btn-danger {
  background: var(--red);
  border: 1px solid var(--red);
  color: #fff;
}
.dialog-btn-danger:hover {
  filter: brightness(1.1);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-fade-enter-active .dialog-card,
.dialog-fade-leave-active .dialog-card {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-from .dialog-card,
.dialog-fade-leave-to .dialog-card {
  transform: scale(0.96);
  opacity: 0;
}
</style>
