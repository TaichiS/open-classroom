<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-slate-300 bg-white hover:bg-slate-100 text-slate-900',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  ghost: 'hover:bg-slate-100 text-slate-900',
  link: 'text-slate-900 underline-offset-4 hover:underline',
}

const sizeClasses = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
}

const classes = computed(() => {
  return [
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50',
    variantClasses[props.variant],
    sizeClasses[props.size],
    props.class,
  ].join(' ')
})

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled" @click="handleClick">
    <slot />
  </button>
</template>
