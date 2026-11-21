<template>
  <Teleport to="body">
    <Transition name="changelog-fade">
      <div v-if="open" class="changelog-overlay" @click.self="close">
        <div
          class="changelog-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="changelog-title"
        >
          <header class="changelog-head">
            <div>
              <h3 id="changelog-title">What's new</h3>
              <p class="changelog-sub">
                YT-DLP Web Interface
                <span class="changelog-version">v{{ appVersion }}</span>
              </p>
            </div>
            <button ref="closeBtn" class="modal-close" type="button" aria-label="Close changelog" @click="close">
              &times;
            </button>
          </header>

          <div class="changelog-body">
            <section v-for="entry in changelog" :key="entry.version" class="changelog-entry">
              <div class="entry-head">
                <h4>{{ entry.version }}</h4>
                <time>{{ entry.date }}</time>
              </div>
              <ul>
                <li v-for="(item, i) in entry.items" :key="i">{{ item }}</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { appVersion, changelog } from '../data/changelog'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])
const closeBtn = ref(null)

function close() {
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      closeBtn.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.changelog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
}
.changelog-card {
  width: 100%;
  max-width: 520px;
  max-height: min(80vh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.changelog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.changelog-head h3 {
  margin: 0;
  font-size: 17px;
}
.changelog-sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.changelog-version {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 700;
}
.modal-close {
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.modal-close:hover {
  color: var(--text);
}
.changelog-body {
  overflow-y: auto;
  padding: 18px 20px 22px;
}
.changelog-entry + .changelog-entry {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
}
.entry-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.entry-head h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 760;
  color: var(--text);
}
.entry-head time {
  color: var(--faint);
  font-size: 11px;
}
.changelog-entry ul {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.6;
}
.changelog-entry li + li {
  margin-top: 4px;
}
.changelog-fade-enter-active,
.changelog-fade-leave-active {
  transition: opacity 0.18s ease;
}
.changelog-fade-enter-from,
.changelog-fade-leave-to {
  opacity: 0;
}
</style>
