<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'

interface Props {
  modelValue: string
  placeholder?: string
  minHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '輸入 Markdown 內容...',
  minHeight: '320px',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const activeTab = ref<'edit' | 'preview'>('edit')

const renderedHtml = computed(() => {
  if (!props.modelValue) return '<p style="color:#94a3b8;">（尚無內容）</p>'
  return marked(props.modelValue) as string
})
</script>

<template>
  <div class="markdown-editor border border-slate-200 rounded-lg overflow-hidden">
    <!-- Tab Bar -->
    <div class="flex border-b border-slate-200 bg-slate-50">
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'edit'
            ? 'text-slate-900 border-b-2 border-slate-900 bg-white'
            : 'text-slate-500 hover:text-slate-700'
        ]"
        @click="activeTab = 'edit'"
      >
        ✏️ 編輯
      </button>
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'preview'
            ? 'text-slate-900 border-b-2 border-slate-900 bg-white'
            : 'text-slate-500 hover:text-slate-700'
        ]"
        @click="activeTab = 'preview'"
      >
        👁 預覽
      </button>
      <div class="flex-1" />
      <span class="px-3 py-2 text-xs text-slate-400 self-center">
        {{ modelValue.length }} 字元
      </span>
    </div>

    <!-- Desktop: side-by-side; Mobile: tab switch -->
    <div class="md-content-area flex">
      <!-- Editor -->
      <div
        :class="[
          'flex-1',
          activeTab === 'preview' ? 'hidden md:block md:border-r md:border-slate-200' : ''
        ]"
      >
        <textarea
          class="w-full resize-none border-0 outline-none p-4 font-mono text-sm text-slate-800 bg-white leading-relaxed"
          :style="{ minHeight: minHeight }"
          :placeholder="placeholder"
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <!-- Preview -->
      <div
        :class="[
          'flex-1 overflow-auto',
          activeTab === 'edit' ? 'hidden md:block' : ''
        ]"
      >
        <div
          class="md-preview p-4"
          :style="{ minHeight: minHeight }"
          v-html="renderedHtml"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-preview :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0.75rem 0 0.5rem;
  line-height: 1.3;
}

.md-preview :deep(h2) {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 1rem 0 0.5rem;
  padding-left: 0.75rem;
  border-left: 4px solid #38bdf8;
}

.md-preview :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin: 0.75rem 0 0.375rem;
}

.md-preview :deep(p) {
  margin: 0.5rem 0;
  color: #334155;
  line-height: 1.75;
}

.md-preview :deep(code:not(pre code)) {
  background: #f1f5f9;
  color: #be123c;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
}

.md-preview :deep(pre) {
  background: #0f172a;
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.md-preview :deep(pre code) {
  background: transparent;
  color: #cdd6f4;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
  padding: 0;
  border-radius: 0;
}

.md-preview :deep(blockquote) {
  border-left: 4px solid #38bdf8;
  background: #f8fafc;
  padding: 0.5rem 1rem;
  margin: 0.75rem 0;
  border-radius: 0 6px 6px 0;
  color: #475569;
}

.md-preview :deep(ul) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
  list-style: none;
}

.md-preview :deep(ul li) {
  position: relative;
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  color: #334155;
  line-height: 1.6;
}

.md-preview :deep(ul li::before) {
  content: '•';
  position: absolute;
  left: -0.5rem;
  color: #0284c7;
  font-weight: 700;
}

.md-preview :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.md-preview :deep(ol li) {
  margin: 0.25rem 0;
  color: #334155;
  line-height: 1.6;
}

.md-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}

.md-preview :deep(th) {
  background: #f8fafc;
  color: #334155;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  text-align: left;
}

.md-preview :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  color: #334155;
}

.md-preview :deep(tr:nth-child(even) td) {
  background: #f8fafc;
}

.md-preview :deep(a) {
  color: #0284c7;
  text-decoration: none;
}

.md-preview :deep(a:hover) {
  text-decoration: underline;
}

.md-preview :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}

.md-preview :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1rem 0;
}

/* Desktop: show both panels */
@media (min-width: 768px) {
  .md-content-area > * {
    display: block !important;
  }
}
</style>
