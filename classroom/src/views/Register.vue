<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { GraduationCap, Loader2 } from 'lucide-vue-next'
import { ref } from 'vue'

const authStore = useAuthStore()
const isLoading = ref(false)

async function handleGoogleRegister() {
  isLoading.value = true
  await authStore.loginWithGoogle()
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div class="w-full max-w-md">
      <div class="flex justify-center mb-8">
        <div class="flex items-center gap-2">
          <GraduationCap class="h-10 w-10 text-slate-900" />
          <span class="text-2xl font-bold">作業管理系統</span>
        </div>
      </div>

      <Card>
        <CardHeader class="space-y-1">
          <CardTitle class="text-2xl text-center">註冊</CardTitle>
          <CardDescription class="text-center">
            使用 Google 帳號建立新帳號
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button class="w-full" :disabled="isLoading" @click="handleGoogleRegister">
            <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
            <span v-else>使用 Google 帳號註冊</span>
          </Button>

          <div class="mt-4 text-center text-sm">
            已經有帳號？
            <router-link to="/login" class="text-slate-900 underline">
              立即登入
            </router-link>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
