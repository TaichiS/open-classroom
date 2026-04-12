<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: number
  max?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  max: 100,
})

const percentage = computed(() => {
  return Math.min(100, Math.max(0, (props.modelValue / props.max) * 100))
})
</script>

<template>
  <div :class="['relative h-4 w-full overflow-hidden rounded-full bg-slate-100', props.class]">
    <div
      class="h-full bg-slate-900 transition-all duration-300 ease-in-out"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
