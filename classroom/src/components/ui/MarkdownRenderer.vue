<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  content: string
}

const props = defineProps<Props>()

const renderedHtml = computed(() => {
  if (!props.content) return ''
  return marked(props.content) as string
})
</script>

<template>
  <div class="md-render" v-html="renderedHtml" />
</template>

<style scoped>
.md-render :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  color: #6366f1;
  margin: 0.75rem 0 0.5rem;
  line-height: 1.3;
}

.md-render :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  color: #374151;
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.25rem;
  background: linear-gradient(90deg, #6366f1, transparent) bottom / 100% 2px no-repeat;
}

.md-render :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  color: #8b5cf6;
  margin: 0.75rem 0 0.375rem;
}

.md-render :deep(p) {
  margin: 0.5rem 0;
  color: #374151;
  line-height: 1.7;
}

.md-render :deep(code:not(pre code)) {
  background: #f0f0ff;
  color: #e11d48;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
}

.md-render :deep(pre) {
  background: #1e1e2e;
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.md-render :deep(pre code) {
  background: transparent;
  color: #cdd6f4;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
  padding: 0;
  border-radius: 0;
}

.md-render :deep(blockquote) {
  border-left: 4px solid #6366f1;
  background: #fafaff;
  padding: 0.5rem 1rem;
  margin: 0.75rem 0;
  border-radius: 0 6px 6px 0;
  color: #4b5563;
}

.md-render :deep(ul) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
  list-style: none;
}

.md-render :deep(ul li) {
  position: relative;
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  color: #374151;
  line-height: 1.6;
}

.md-render :deep(ul li::before) {
  content: '•';
  position: absolute;
  left: -0.5rem;
  color: #6366f1;
  font-weight: 700;
}

.md-render :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.md-render :deep(ol li) {
  margin: 0.25rem 0;
  color: #374151;
  line-height: 1.6;
}

.md-render :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}

.md-render :deep(th) {
  background: #f0f0ff;
  color: #4b5563;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.md-render :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.md-render :deep(tr:nth-child(even) td) {
  background: #f8f8ff;
}

.md-render :deep(a) {
  color: #6366f1;
  text-decoration: none;
}

.md-render :deep(a:hover) {
  text-decoration: underline;
}

.md-render :deep(strong) {
  font-weight: 700;
  color: #6366f1;
}

.md-render :deep(hr) {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 1rem 0;
}
</style>
