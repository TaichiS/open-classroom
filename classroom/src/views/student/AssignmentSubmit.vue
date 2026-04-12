<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  MousePointerClick,
  Loader2,
} from 'lucide-vue-next'
import {
  findAssignmentById,
  findCourseById,
  findSubmission,
  upsertSubmission,
  findMember,
  updateMemberProgress,
  getAssignmentsByCourse,
} from '@/lib/db'
import type { Assignment, Course, SubmitType, Submission } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const assignment = ref<Assignment | null>(null)
const course = ref<Course | null>(null)
const submission = ref<Submission | null>(null)
const submitData = ref('')
const isSubmitting = ref(false)
const message = ref('')

const assignmentId = computed(() => route.params.id as string)

const submitTypeIcons: Record<SubmitType, any> = {
  complete: MousePointerClick,
  file: FileText,
  link: LinkIcon,
  image: ImageIcon,
}

const submitTypeLabels: Record<SubmitType, string> = {
  complete: '點擊完成',
  file: '檔案上傳',
  link: '連結提交',
  image: '圖片上傳',
}

const submitTypeDescriptions: Record<SubmitType, string> = {
  complete: '點擊下方按鈕即可完成此作業',
  file: '請輸入檔案連結或描述',
  link: '請輸入作業連結',
  image: '請輸入圖片連結',
}

onMounted(async () => {
  await loadData()
})

async function loadData() {
  if (!authStore.profile) return

  const assignmentData = await findAssignmentById(assignmentId.value)
  if (!assignmentData) {
    router.push('/')
    return
  }

  const courseData = await findCourseById(assignmentData.courseId)
  if (!courseData) {
    router.push('/')
    return
  }

  assignment.value = assignmentData
  course.value = courseData

  const existingSubmission = await findSubmission(assignmentId.value, authStore.profile.id)
  if (existingSubmission) {
    submission.value = existingSubmission
    if (existingSubmission.submitData) {
      submitData.value = existingSubmission.submitData
    }
  }
}

async function handleSubmit() {
  if (!authStore.profile || !assignment.value) return

  isSubmitting.value = true
  message.value = ''

  try {
    const now = new Date().toISOString()
    const isCompleted = assignment.value.submitType === 'complete' ? true : submitData.value.trim() !== ''

    if (!isCompleted) {
      message.value = '請輸入提交內容'
      return
    }

    await upsertSubmission({
      assignmentId: assignment.value.id,
      studentId: authStore.profile.id,
      status: 'completed',
      submitData: submitData.value || undefined,
      submittedAt: now,
    })

    // Update member progress
    const member = await findMember(assignment.value.courseId, authStore.profile.id)
    if (member) {
      const assignments = await getAssignmentsByCourse(assignment.value.courseId)
      const currentIndex = assignments.findIndex(a => a.id === assignment.value!.id)
      if (currentIndex !== -1 && currentIndex >= member.currentAssignmentIndex) {
        await updateMemberProgress(assignment.value.courseId, authStore.profile.id, currentIndex + 1)
      }
    }

    message.value = '作業提交成功！'
    setTimeout(() => {
      router.push(`/course/${assignment.value!.courseId}`)
    }, 1500)
  } catch (e) {
    message.value = '提交時發生錯誤，請重試'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="assignment && course" class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <Button variant="ghost" size="sm" @click="router.push(`/course/${course.id}`)">
          <ArrowLeft class="h-4 w-4 mr-2" />
          返回課程
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2 mb-2">
            <component :is="submitTypeIcons[assignment.submitType]" class="h-5 w-5 text-slate-600" />
            <span class="text-sm text-slate-600">{{ submitTypeLabels[assignment.submitType] }}</span>
          </div>
          <CardTitle>{{ assignment.title }}</CardTitle>
          <CardDescription>{{ assignment.description }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Submission Status -->
          <div v-if="submission?.status === 'completed'" class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2 text-green-700">
              <CheckCircle class="h-5 w-5" />
              <span class="font-medium">作業已完成</span>
            </div>
            <p v-if="submission.submittedAt" class="text-sm text-green-600 mt-1">
              提交時間：{{ new Date(submission.submittedAt).toLocaleString('zh-TW') }}
            </p>
          </div>

          <!-- Submit Form -->
          <div class="space-y-4">
            <p class="text-sm text-slate-600">{{ submitTypeDescriptions[assignment.submitType] }}</p>

            <div v-if="assignment.submitType !== 'complete'">
              <Input
                v-model="submitData"
                :placeholder="
                  assignment.submitType === 'link'
                    ? '請輸入連結'
                    : assignment.submitType === 'file'
                    ? '請輸入檔案描述或連結'
                    : '請輸入圖片連結'
                "
              />
            </div>

            <div v-if="message" :class="[
              'text-sm text-center p-2 rounded',
              message.includes('成功') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
            ]">
              {{ message }}
            </div>

            <Button
              class="w-full"
              :disabled="isSubmitting || submission?.status === 'completed'"
              @click="handleSubmit"
            >
              <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
              <CheckCircle v-else-if="submission?.status === 'completed'" class="mr-2 h-4 w-4" />
              <component v-else :is="submitTypeIcons[assignment.submitType]" class="mr-2 h-4 w-4" />
              {{ submission?.status === 'completed' ? '已完成' : isSubmitting ? '提交中...' : '提交作業' }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
