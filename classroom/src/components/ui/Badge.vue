<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const variantClasses = {
  default: 'bg-slate-900 text-slate-50 hover:bg-slate-900/80',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-100/80',
  destructive: 'bg-red-100 text-red-700 hover:bg-red-100/80',
  outline: 'border border-slate-300 text-slate-900 hover:bg-slate-100',
  success: 'bg-green-100 text-green-700 hover:bg-green-100/80',
}

const classes = computed(() => {
  return [
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
    variantClasses[props.variant],
    props.class,
  ].join(' ')
})
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
