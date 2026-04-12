<script setup lang="ts">
interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="['p-6 pt-0', props.class]">
    <slot />
  </div>
</template>
