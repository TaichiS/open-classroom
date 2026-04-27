<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer.vue'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  MousePointerClick,
  Loader2,
  CalendarDays,
  Clock,
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

const submitInputPlaceholders: Record<SubmitType, string> = {
  complete: '',
  file: '請輸入檔案描述或連結',
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
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
    <main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">

      <!-- Assignment Description Card -->
      <Card>
        <CardContent class="!p-6">
          <!-- Submit type badge -->
          <div class="flex items-center gap-2 mb-4 text-sm text-slate-500">
            <component :is="submitTypeIcons[assignment.submitType]" class="h-4 w-4" />
            <span>{{ submitTypeLabels[assignment.submitType] }}</span>
          </div>

          <!-- Markdown rendered description -->
          <MarkdownRenderer
            v-if="assignment.description"
            :content="assignment.description"
          />

          <!-- Dates -->
          <div class="flex flex-wrap gap-4 text-xs text-slate-500 mt-5 pt-4 border-t border-slate-100">
            <span class="flex items-center gap-1">
              <CalendarDays class="h-3.5 w-3.5" />
              發布：{{ formatDate(assignment.releaseDate) }}
            </span>
            <span v-if="assignment.dueDate" class="flex items-center gap-1">
              <Clock class="h-3.5 w-3.5" />
              截止：{{ formatDate(assignment.dueDate) }}
            </span>
          </div>
        </CardContent>
      </Card>

      <!-- Submit Card -->
      <Card>
        <CardContent class="!p-6 space-y-4">
          <h2 class="font-semibold text-slate-900">提交作業</h2>

          <!-- Already completed -->
          <div v-if="submission?.status === 'completed'" class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2 text-green-700">
              <CheckCircle2 class="h-5 w-5" />
              <span class="font-medium">作業已完成</span>
            </div>
            <p v-if="submission.submittedAt" class="text-sm text-green-600 mt-1">
              提交時間：{{ new Date(submission.submittedAt).toLocaleString('zh-TW') }}
            </p>
          </div>

          <!-- Input (non-complete types) -->
          <div v-if="assignment.submitType !== 'complete'">
            <Input
              v-model="submitData"
              :placeholder="submitInputPlaceholders[assignment.submitType]"
              :disabled="submission?.status === 'completed'"
            />
          </div>

          <!-- Feedback message -->
          <div
            v-if="message"
            :class="[
              'text-sm text-center p-3 rounded-lg',
              message.includes('成功') ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'
            ]"
          >
            {{ message }}
          </div>

          <!-- Submit button -->
          <Button
            class="w-full"
            :disabled="isSubmitting || submission?.status === 'completed'"
            @click="handleSubmit"
          >
            <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
            <CheckCircle2 v-else-if="submission?.status === 'completed'" class="mr-2 h-4 w-4" />
            <component v-else :is="submitTypeIcons[assignment.submitType]" class="mr-2 h-4 w-4" />
            {{ submission?.status === 'completed' ? '已完成' : isSubmitting ? '提交中...' : '提交作業' }}
          </Button>
        </CardContent>
      </Card>

    </main>
  </div>
</template>
