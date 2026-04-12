<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  class?: string
  id?: string
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  keydown: [event: KeyboardEvent]
}>()

const classes = computed(() => {
  return [
    'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ].join(' ')
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleKeydown(event: KeyboardEvent) {
  emit('keydown', event)
}
</script>

<template>
  <input
    :id="id"
    :name="name"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :class="classes"
    @input="handleInput"
    @keydown="handleKeydown"
  />
</template>
