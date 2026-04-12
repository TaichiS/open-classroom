<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

useAuthStore()
</script>

<template>
  <router-view />
</template>

<style>
@import './assets/index.css';
</style>
