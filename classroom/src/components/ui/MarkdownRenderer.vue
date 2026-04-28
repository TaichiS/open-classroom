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
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1rem;
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.md-render :deep(h2) {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 2rem 0 0.75rem;
  padding-left: 0.875rem;
  border-left: 4px solid #38bdf8;
}

.md-render :deep(h3) {
  font-size: 1rem;
  font-weight: 700;
  color: #334155;
  margin: 1.5rem 0 0.5rem;
}

.md-render :deep(p) {
  margin: 0.75rem 0;
  color: #334155;
  line-height: 1.85;
}

.md-render :deep(code:not(pre code)) {
  background: #f1f5f9;
  color: #be123c;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
}

.md-render :deep(pre) {
  background: #0f172a;
  border-radius: 14px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
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
  border-left: 4px solid #38bdf8;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 0 12px 12px 0;
  color: #475569;
}

.md-render :deep(ul) {
  padding-left: 1.5rem;
  margin: 0.75rem 0;
  list-style: none;
}

.md-render :deep(ul li) {
  position: relative;
  padding-left: 0.75rem;
  margin: 0.4rem 0;
  color: #334155;
  line-height: 1.75;
}

.md-render :deep(ul li::before) {
  content: '•';
  position: absolute;
  left: -0.5rem;
  color: #0284c7;
  font-weight: 700;
}

.md-render :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.md-render :deep(ol li) {
  margin: 0.4rem 0;
  color: #334155;
  line-height: 1.75;
}

.md-render :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}

.md-render :deep(th) {
  background: #f8fafc;
  color: #334155;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  text-align: left;
}

.md-render :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  color: #334155;
}

.md-render :deep(tr:nth-child(even) td) {
  background: #f8fafc;
}

.md-render :deep(a) {
  color: #0284c7;
  text-decoration: none;
  font-weight: 600;
}

.md-render :deep(a:hover) {
  text-decoration: underline;
}

.md-render :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}

.md-render :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1.5rem 0;
}

@media (max-width: 640px) {
  .md-render :deep(h1) {
    font-size: 1.5rem;
  }

  .md-render :deep(h2) {
    margin-top: 1.5rem;
  }
}
</style>
