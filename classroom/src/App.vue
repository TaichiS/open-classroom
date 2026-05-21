<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { BookOpen } from 'lucide-vue-next'

const authStore = useAuthStore()
</script>

<template>
  <div
    v-if="authStore.isLoading"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50"
  >
    <div class="flex items-center gap-3 mb-8 text-slate-900">
      <BookOpen class="h-7 w-7" />
      <span class="text-xl font-semibold">作業管理系統</span>
    </div>
    <div class="w-64 h-1 rounded-full bg-slate-200 overflow-hidden">
      <div class="loading-bar h-full rounded-full bg-blue-600" />
    </div>
    <p class="mt-4 text-sm text-slate-500">載入中...</p>
  </div>
  <router-view v-else />
</template>

<style>
@import './assets/index.css';

@keyframes loading-bar-slide {
  0% {
    transform: translateX(-100%);
    width: 30%;
  }
  50% {
    width: 60%;
  }
  100% {
    transform: translateX(350%);
    width: 30%;
  }
}

.loading-bar {
  animation: loading-bar-slide 1.4s ease-in-out infinite;
}
</style>
