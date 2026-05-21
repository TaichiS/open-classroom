<script setup lang="ts">
import { Button } from '@/components/ui/Button'
import { AlertCircle, RefreshCw } from 'lucide-vue-next'

defineProps<{
  message?: string | null
  isRetrying?: boolean
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="rounded-md border border-red-200 bg-red-50 p-4 flex items-start gap-3">
    <AlertCircle class="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
    <div class="flex-1 text-sm text-red-700">
      {{ message || '載入失敗，請檢查網路連線後重試。' }}
    </div>
    <Button size="sm" variant="outline" :disabled="isRetrying" @click="$emit('retry')">
      <RefreshCw class="h-4 w-4 mr-1" :class="{ 'animate-spin': isRetrying }" />
      重試
    </Button>
  </div>
</template>
