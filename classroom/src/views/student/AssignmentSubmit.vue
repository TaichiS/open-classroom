<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
  BookOpen,
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
const isCompleted = computed(() => submission.value?.status === 'completed')
const submitActionLabel = computed(() => {
  if (isCompleted.value) return '已完成'
  if (isSubmitting.value) return '提交中...'
  return assignment.value?.submitType === 'complete' ? '標記為完成' : '提交作業'
})

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
  <div v-if="assignment && course" class="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_48%,#f8fafc_100%)] text-slate-900">
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" class="-ml-2 text-slate-600 hover:text-slate-950" @click="router.push(`/course/${course.id}`)">
          <ArrowLeft class="h-4 w-4 mr-2" />
          返回課程
        </Button>
        <span class="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
          {{ course.name }}
        </span>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-10">
      <section class="min-w-0 space-y-6">
        <div class="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70">
          <div class="border-b border-slate-100 bg-slate-950 px-6 py-7 text-white sm:px-8 sm:py-9">
            <div class="mb-5 flex flex-wrap items-center gap-3 text-sm">
              <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-200 ring-1 ring-white/15">
                <BookOpen class="h-4 w-4" />
                {{ course.name }}
              </span>
              <span class="inline-flex items-center gap-2 rounded-full bg-sky-400/15 px-3 py-1.5 text-sky-100 ring-1 ring-sky-300/20">
                <component :is="submitTypeIcons[assignment.submitType]" class="h-4 w-4" />
                {{ submitTypeLabels[assignment.submitType] }}
              </span>
            </div>

            <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {{ assignment.title }}
            </h1>

            <div class="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
              <span class="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <CalendarDays class="h-4 w-4 text-sky-200" />
                發布 {{ formatDate(assignment.releaseDate) }}
              </span>
              <span v-if="assignment.dueDate" class="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <Clock class="h-4 w-4 text-amber-200" />
                截止 {{ formatDate(assignment.dueDate) }}
              </span>
            </div>
          </div>

          <article class="px-6 py-7 sm:px-8 sm:py-9">
            <div v-if="assignment.description" class="assignment-document">
              <MarkdownRenderer :content="assignment.description" />
            </div>
            <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              這份作業尚未提供詳細內容。
            </div>
          </article>
        </div>
      </section>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <div class="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 sm:p-6">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-slate-500">繳交狀態</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">
                {{ isCompleted ? '已完成' : '等待提交' }}
              </h2>
            </div>
            <div
              :class="[
                'flex h-11 w-11 items-center justify-center rounded-2xl',
                isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              ]"
            >
              <CheckCircle2 v-if="isCompleted" class="h-5 w-5" />
              <component v-else :is="submitTypeIcons[assignment.submitType]" class="h-5 w-5" />
            </div>
          </div>

          <div v-if="isCompleted" class="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div class="flex items-center gap-2 font-medium">
              <CheckCircle2 class="h-5 w-5" />
              作業已完成
            </div>
            <p v-if="submission?.submittedAt" class="mt-1 text-sm text-emerald-700">
              提交時間：{{ new Date(submission.submittedAt).toLocaleString('zh-TW') }}
            </p>
          </div>

          <div v-if="assignment.submitType !== 'complete'" class="mb-5 space-y-2">
            <label class="text-sm font-medium text-slate-700">提交內容</label>
            <Input
              v-model="submitData"
              :placeholder="submitInputPlaceholders[assignment.submitType]"
              :disabled="isCompleted"
              class="h-11 rounded-xl border-slate-300 bg-slate-50 focus:bg-white"
            />
          </div>

          <div
            v-if="message"
            :class="[
              'mb-5 rounded-2xl border p-3 text-center text-sm',
              message.includes('成功') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
            ]"
          >
            {{ message }}
          </div>

          <Button
            class="h-12 w-full rounded-2xl bg-slate-950 text-base hover:bg-slate-800"
            :disabled="isSubmitting || isCompleted"
            @click="handleSubmit"
          >
            <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
            <CheckCircle2 v-else-if="isCompleted" class="mr-2 h-4 w-4" />
            <component v-else :is="submitTypeIcons[assignment.submitType]" class="mr-2 h-4 w-4" />
            {{ submitActionLabel }}
          </Button>

          <p class="mt-4 text-center text-xs leading-relaxed text-slate-500">
            完成後系統會自動更新你的課程進度，並解鎖下一個作業。
          </p>
        </div>
      </aside>
    </main>
  </div>
</template>
