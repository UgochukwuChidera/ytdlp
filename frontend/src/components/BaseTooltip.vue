<template>
  <span class="tip">
    <button
      ref="trigger"
      type="button"
      class="tip-trigger"
      :aria-label="label || text"
      :aria-describedby="visible ? tipId : undefined"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      @keydown.esc.stop.prevent="hide"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 11v5"/>
        <path d="M12 8h.01"/>
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="visible" :id="tipId" class="tip-bubble" role="tooltip" :style="bubbleStyle">
        {{ text }}
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { ref, nextTick, onUnmounted } from 'vue'

let uidCounter = 0

const props = defineProps({
  text: { type: String, required: true },
  label: { type: String, default: '' },
})

const tipId = `base-tip-${++uidCounter}`
const trigger = ref(null)
const visible = ref(false)
const bubbleStyle = ref({})

function position() {
  const el = trigger.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const half = Math.min(130, (window.innerWidth - 24) / 2)
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, half + 12),
    window.innerWidth - half - 12,
  )
  bubbleStyle.value = {
    left: `${left}px`,
    top: `${rect.bottom + 8}px`,
  }
}

async function show() {
  visible.value = true
  await nextTick()
  position()
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
}

function hide() {
  visible.value = false
  window.removeEventListener('scroll', hide, true)
  window.removeEventListener('resize', hide)
}

onUnmounted(hide)
</script>

<style scoped>
.tip {
  display: inline-flex;
  align-items: center;
}
.tip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--faint);
  cursor: help;
  transition: color 140ms ease, background 140ms ease;
}
.tip-trigger:hover,
.tip-trigger:focus-visible {
  color: var(--brand);
  background: var(--brand-soft);
  outline: none;
}
.tip-bubble {
  position: fixed;
  z-index: 10000;
  transform: translateX(-50%);
  width: max-content;
  max-width: min(280px, calc(100vw - 24px));
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--text);
  color: var(--surface);
  box-shadow: var(--shadow);
  font-size: 12px;
  line-height: 1.45;
  pointer-events: none;
}
</style>
