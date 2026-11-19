<template>
  <div ref="root" class="select" :class="{ 'select-open': open, 'select-disabled': disabled }">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="select-trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="select-value" :class="{ placeholder: !selectedOption }">
        {{ selectedOption ? selectedOption.label : placeholder }}
      </span>
      <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <ul
      v-if="open"
      :id="listId"
      class="select-menu"
      role="listbox"
      :aria-label="ariaLabel"
      @mousedown.prevent
    >
      <li
        v-for="(opt, i) in normalizedOptions"
        :id="optionId(i)"
        :key="String(opt.value)"
        role="option"
        :aria-selected="isSelected(opt)"
        class="select-option"
        :class="{ active: i === activeIndex, selected: isSelected(opt) }"
        @mouseenter="activeIndex = i"
        @click="choose(opt)"
      >
        <span>{{ opt.label }}</span>
        <svg v-if="isSelected(opt)" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </li>
      <li v-if="normalizedOptions.length === 0" class="select-empty">No options</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

let uidCounter = 0

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select…' },
  ariaLabel: { type: String, default: undefined },
  id: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const uid = `base-select-${++uidCounter}`
const id = computed(() => props.id || `${uid}-trigger`)
const listId = computed(() => `${id.value}-listbox`)

function optionId(index) {
  return `${id.value}-option-${index}`
}

const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const activeIndex = ref(-1)

const normalizedOptions = computed(() =>
  (props.options || []).map((opt) => {
    if (opt !== null && typeof opt === 'object') {
      return { value: opt.value, label: opt.label ?? String(opt.value) }
    }
    return { value: opt, label: String(opt) }
  })
)

function sameValue(a, b) {
  return String(a) === String(b)
}

const selectedOption = computed(() =>
  normalizedOptions.value.find((opt) => sameValue(opt.value, props.modelValue))
)

function isSelected(opt) {
  return sameValue(opt.value, props.modelValue)
}

function toggle() {
  if (props.disabled) return
  open.value ? closeMenu() : openMenu()
}

function openMenu(startAtSelected = true) {
  open.value = true
  const selectedIdx = normalizedOptions.value.findIndex(isSelected)
  activeIndex.value = startAtSelected && selectedIdx >= 0 ? selectedIdx : 0
}

function closeMenu(refocus = true) {
  open.value = false
  if (refocus) nextTick(() => trigger.value?.focus())
}

function choose(opt) {
  if (!sameValue(opt.value, props.modelValue)) {
    emit('update:modelValue', opt.value)
    emit('change', opt.value)
  }
  closeMenu()
}

function moveActive(delta) {
  const count = normalizedOptions.value.length
  if (count === 0) return
  activeIndex.value = (activeIndex.value + delta + count) % count
}

function onKeydown(event) {
  if (props.disabled) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!open.value) openMenu()
      else moveActive(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) openMenu()
      else moveActive(-1)
      break
    case 'Home':
      if (open.value) {
        event.preventDefault()
        activeIndex.value = 0
      }
      break
    case 'End':
      if (open.value) {
        event.preventDefault()
        activeIndex.value = normalizedOptions.value.length - 1
      }
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!open.value) {
        openMenu()
      } else if (activeIndex.value >= 0 && normalizedOptions.value[activeIndex.value]) {
        choose(normalizedOptions.value[activeIndex.value])
      }
      break
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
      }
      break
    case 'Tab':
      if (open.value) closeMenu(false)
      break
  }
}

function onClickOutside(event) {
  if (open.value && root.value && !root.value.contains(event.target)) {
    closeMenu(false)
  }
}

watch(open, (val) => {
  if (val) {
    const selectedIdx = normalizedOptions.value.findIndex(isSelected)
    if (selectedIdx >= 0) activeIndex.value = selectedIdx
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onClickOutside)
})
</script>

<style scoped>
.select {
  position: relative;
  min-width: 0;
  width: 100%;
}

.select-trigger {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.select-trigger:hover {
  border-color: color-mix(in srgb, var(--brand), var(--line) 45%);
}

.select-trigger:focus-visible,
.select-open .select-trigger {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.placeholder {
  color: var(--faint);
}

.select-chevron {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 140ms ease;
}

.select-open .select-chevron {
  transform: rotate(180deg);
}

.select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1200;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 7px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.select-option.active {
  background: var(--surface-2);
}

.select-option.selected {
  color: var(--brand);
  background: var(--brand-soft);
}

.select-option svg {
  flex-shrink: 0;
}

.select-empty {
  padding: 9px 10px;
  color: var(--muted);
  font-size: 12px;
}
</style>
