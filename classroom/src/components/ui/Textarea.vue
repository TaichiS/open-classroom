<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  rows?: number
  class?: string
  id?: string
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  required: false,
  rows: 3,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const classes = computed(() => {
  return [
    'flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none',
    props.class,
  ].join(' ')
})

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <textarea
    :id="id"
    :name="name"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :rows="rows"
    :class="classes"
    @input="handleInput"
  />
</template>
