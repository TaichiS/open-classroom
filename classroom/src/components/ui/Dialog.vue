<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  open?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function close() {
  emit('update:open', false)
}

const backdropClasses = computed(() => {
  return [
    'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    props.open ? 'block' : 'hidden',
  ].join(' ')
})

const contentClasses = computed(() => {
  const hasMaxWidth = props.class?.includes('max-w-')
  return [
    'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-lg duration-200 sm:rounded-lg',
    hasMaxWidth ? '' : 'max-w-lg',
    props.open ? 'block' : 'hidden',
    props.class,
  ].join(' ')
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
    <div :class="backdropClasses" @click="close" />
    <div :class="contentClasses">
      <slot />
      <button
        class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none"
        @click="close"
      >
        <X class="h-4 w-4" />
        <span class="sr-only">關閉</span>
      </button>
    </div>
  </div>
</template>
