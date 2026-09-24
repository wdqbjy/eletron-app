<template>
  <div ref="rootRef" class="app-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button
      ref="triggerRef"
      type="button"
      class="app-select-trigger"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="app-select-label">{{ currentLabel }}</span>
      <svg
        class="app-select-chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        width="14"
        height="14"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="app-select-menu">
      <ul v-if="open" class="app-select-menu" role="listbox">
        <li
          v-for="opt in options"
          :key="String(opt.value)"
          class="app-select-option"
          :class="{ 'is-selected': opt.value === modelValue }"
          role="option"
          :aria-selected="opt.value === modelValue"
          @click="choose(opt.value)"
        >
          <span class="app-select-option-label">{{ opt.label }}</span>
          <svg
            v-if="opt.value === modelValue"
            class="app-select-check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            width="13"
            height="13"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface SelectOption {
  value: string | number
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    disabled?: boolean
  }>(),
  { disabled: false }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const open = ref(false)

const currentLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? ''
)

function toggle(): void {
  if (props.disabled) return
  open.value = !open.value
}

function choose(value: string | number): void {
  emit('update:modelValue', String(value))
  open.value = false
}

function onDocumentMousedown(e: MouseEvent): void {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    triggerRef.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMousedown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<style scoped>
/* ============ 触发器 ============ */
.app-select {
  position: relative;
  display: inline-block;
}

.app-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 132px;
  padding: 8px 12px 8px 14px;
  font-size: 13px;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.9);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.045) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.app-select-trigger:hover:not(:disabled) {
  border-color: rgba(var(--brand-rgb), 0.5);
  background: linear-gradient(180deg, rgba(var(--brand-rgb), 0.12) 0%, rgba(255, 255, 255, 0.05) 100%);
}

.app-select.is-open .app-select-trigger {
  border-color: rgba(var(--brand-rgb), 0.65);
  box-shadow: 0 0 0 3px rgba(var(--brand-rgb), 0.18);
}

.app-select-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--brand-rgb), 0.22);
}

.app-select-trigger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.app-select-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-select-chevron {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.22s ease, color 0.18s ease;
}

.app-select.is-open .app-select-chevron {
  transform: rotate(180deg);
  color: var(--brand);
}

/* ============ 下拉菜单 ============ */
.app-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  min-width: 100%;
  width: max-content;
  max-width: 260px;
  max-height: 232px;
  margin: 0;
  padding: 5px;
  list-style: none;
  overflow-y: auto;
  border-radius: 12px;
  background: rgba(34, 32, 40, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.45),
    0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
}

/* 细滚动条 */
.app-select-menu::-webkit-scrollbar {
  width: 6px;
}
.app-select-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: 3px;
}
.app-select-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--brand-rgb), 0.4);
}

.app-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}

.app-select-option:hover {
  background: rgba(var(--brand-rgb), 0.14);
  color: #fff;
}

.app-select-option.is-selected {
  color: var(--brand);
  background: rgba(var(--brand-rgb), 0.1);
  font-weight: 600;
}

.app-select-check {
  flex-shrink: 0;
}

/* ============ 展开/收起动画 ============ */
.app-select-menu-enter-active,
.app-select-menu-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform-origin: top right;
}
.app-select-menu-enter-from,
.app-select-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

/* ============ 浅色模式 ============ */
.light .app-select-trigger {
  color: rgba(24, 24, 28, 0.88);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.025) 100%);
  border-color: rgba(0, 0, 0, 0.1);
}

.light .app-select-trigger:hover:not(:disabled) {
  border-color: rgba(var(--brand-rgb), 0.55);
  background: linear-gradient(180deg, rgba(var(--brand-rgb), 0.08) 0%, rgba(0, 0, 0, 0.02) 100%);
}

.light .app-select-chevron {
  color: rgba(40, 40, 46, 0.5);
}

.light .app-select-menu {
  background: rgba(252, 252, 254, 0.95);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

.light .app-select-menu::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}

.light .app-select-option {
  color: rgba(24, 24, 28, 0.78);
}

.light .app-select-option:hover {
  background: rgba(var(--brand-rgb), 0.1);
  color: rgba(24, 24, 28, 0.95);
}

.light .app-select-option.is-selected {
  background: rgba(var(--brand-rgb), 0.08);
}
</style>
