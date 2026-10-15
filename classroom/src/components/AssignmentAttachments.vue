<script setup lang="ts">
import { ref, watch } from 'vue'
import { Paperclip, Upload, Download, Trash2, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/Button'
import type { AssignmentAttachment } from '@/types'
import { ATTACHMENT_ACCEPT, listAttachments, uploadAttachment, deleteAttachment, downloadAttachment, completeAttachment, formatFileSize } from '@/lib/attachments'

const props = defineProps<{ assignmentId: string; editable?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const files = ref<AssignmentAttachment[]>([])
const loading = ref(false)
const busy = ref(false)
watch(busy, value => emit('busy', value), { flush: 'sync' })
const error = ref('')
const progress = ref('')
const input = ref<HTMLInputElement | null>(null)
let generation = 0

async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await listAttachments(props.assignmentId)
    if (current === generation) files.value = result
  } catch (e) {
    if (current === generation) error.value = e instanceof Error ? e.message : '附件載入失敗'
  } finally { if (current === generation) loading.value = false }
}
watch(() => props.assignmentId, () => { files.value = []; void load() }, { immediate: true })

async function upload(selected: FileList | File[] | null) {
  if (!selected || busy.value || !props.editable) return
  const queue = Array.from(selected)
  const assignmentId = props.assignmentId
  busy.value = true
  error.value = ''
  const failures: string[] = []
  for (const [index, file] of queue.entries()) {
    progress.value = `上傳 ${index + 1}/${queue.length}：${file.name}`
    try { await uploadAttachment(assignmentId, file) }
    catch (e) { failures.push(e instanceof Error ? e.message : `${file.name} 上傳失敗`) }
  }
  progress.value = ''
  if (input.value) input.value.value = ''
  await load()
  if (failures.length) error.value = [error.value, ...failures].filter(Boolean).join('\n')
  busy.value = false
}
async function run(action: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try { await action(); await load() }
  catch (e) { error.value = e instanceof Error ? e.message : '附件操作失敗' }
  finally { busy.value = false }
}
function remove(file: AssignmentAttachment) {
  if (confirm(`確定刪除附件「${file.fileName}」？`)) void run(() => deleteAttachment(file.id))
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label="作業附件">
    <div class="flex items-center justify-between gap-3">
      <h3 class="flex items-center gap-2 font-semibold text-slate-900"><Paperclip class="h-4 w-4" />作業附件</h3>
      <Button type="button" variant="ghost" size="sm" :disabled="busy || loading" @click="load">重新整理</Button>
    </div>
    <div v-if="editable" class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center"
      @dragover.prevent @drop.prevent="upload($event.dataTransfer?.files ?? null)">
      <input ref="input" type="file" multiple :accept="ATTACHMENT_ACCEPT" :disabled="busy" class="sr-only" aria-label="選擇作業附件"
        @change="upload(($event.target as HTMLInputElement).files)" />
      <Button type="button" variant="outline" :disabled="busy" @click="input?.click()">
        <Upload class="mr-2 h-4 w-4" />選擇附件
      </Button>
      <p class="mt-2 text-sm text-slate-500">可拖曳多個檔案，每檔最多 25 MB。支援文件、圖片、錄音與 ZIP。</p>
      <p class="mt-1 text-xs text-slate-500">附件變更會立即儲存。</p>
    </div>
    <p v-if="progress" role="status" class="text-sm text-sky-700 break-all">{{ progress }}</p>
    <p v-if="error" role="alert" class="text-sm text-red-700 whitespace-pre-line">{{ error }}</p>
    <p v-if="loading" class="flex items-center gap-2 text-sm text-slate-500"><Loader2 class="h-4 w-4 animate-spin" />載入附件…</p>
    <p v-else-if="!files.length && !error" class="text-sm text-slate-500">尚無附件</p>
    <ul v-if="files.length" class="divide-y divide-slate-100">
      <li v-for="file in files" :key="file.id" class="flex flex-wrap items-center gap-2 py-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-900 break-all">{{ file.fileName }}</p>
          <p class="text-xs text-slate-500">{{ formatFileSize(file.size) }}<span v-if="file.status !== 'ready'"> · {{ file.status === 'pending' ? '尚未確認完成' : '刪除未完成，請重試' }}</span></p>
        </div>
        <Button v-if="file.status === 'ready'" type="button" variant="outline" size="sm" :disabled="busy" @click="run(() => downloadAttachment(file.id))">
          <Download class="mr-1 h-4 w-4" />下載
        </Button>
        <Button v-if="editable && file.status === 'pending'" type="button" variant="outline" size="sm" :disabled="busy" @click="run(() => completeAttachment(file.id))">重試確認</Button>
        <Button v-if="editable" type="button" variant="ghost" size="sm" class="text-red-600" :disabled="busy" :aria-label="`刪除 ${file.fileName}`" @click="remove(file)"><Trash2 class="h-4 w-4" /></Button>
      </li>
    </ul>
  </section>
</template>
