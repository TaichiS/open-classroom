<script setup lang="ts">
interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="['rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm', props.class]">
    <slot />
  </div>
</template>
