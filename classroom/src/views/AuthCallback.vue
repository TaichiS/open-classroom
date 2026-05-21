<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

onMounted(() => {
  if (!authStore.isLoading) {
    redirect()
    return
  }

  // 最多等 10 秒；逾時也強制走 redirect，避免 spinner 永遠轉
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    unwatch()
    window.clearTimeout(timeoutId)
    redirect()
  }
  const unwatch = authStore.$subscribe((_mutation, state) => {
    if (!state.isLoading) finish()
  })
  const timeoutId = window.setTimeout(() => {
    console.warn('Auth callback wait timed out after 10s; redirecting anyway.')
    finish()
  }, 10000)
})

function redirect() {
  if (authStore.needsOnboarding) {
    router.replace('/onboarding')
  } else if (authStore.isTeacher) {
    router.replace('/teacher')
  } else {
    router.replace('/')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
      <p class="text-slate-500">登入中，請稍候...</p>
    </div>
  </div>
</template>
