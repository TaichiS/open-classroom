<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createProfile } from '@/lib/db'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import type { UserRole } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const isSubmitting = ref(false)

async function selectRole(role: UserRole) {
  if (!authStore.user) return
  isSubmitting.value = true

  await createProfile({
    id: authStore.user.id,
    name: authStore.user.user_metadata?.full_name ?? authStore.user.email ?? '未命名',
    role,
    avatar: authStore.user.user_metadata?.avatar_url,
  })

  await authStore.refreshProfile()

  router.replace(role === 'teacher' ? '/teacher' : '/')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <CardTitle>請選擇您的身份</CardTitle>
        <CardDescription>這將決定您在平台上的使用方式</CardDescription>
      </CardHeader>
      <CardContent class="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          class="h-24 flex flex-col gap-2"
          :disabled="isSubmitting"
          @click="selectRole('teacher')"
        >
          <span class="text-2xl">👩‍🏫</span>
          <span>我是老師</span>
        </Button>
        <Button
          variant="outline"
          class="h-24 flex flex-col gap-2"
          :disabled="isSubmitting"
          @click="selectRole('student')"
        >
          <span class="text-2xl">👨‍🎓</span>
          <span>我是學生</span>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
