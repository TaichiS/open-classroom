<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  ArrowLeft,
  XCircle,
  Trophy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MousePointerClick,
  Loader2,
} from 'lucide-vue-next'
import {
  findAssignmentById,
  findCourseById,
  getSubmissionsByAssignment,
  findProfileById,
  updateSubmissionFeedback,
  updateSubmissionShowcase,
} from '@/lib/db'
import type { Assignment, Course, Submission, Profile } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const assignment = ref<Assignment | null>(null)
const course = ref<Course | null>(null)
const submissions = ref<(Submission & { student?: Profile })[]>([])
const selectedSubmission = ref<(Submission & { student?: Profile }) | null>(null)
const isFeedbackDialogOpen = ref(false)
const isShowcaseDialogOpen = ref(false)
const feedback = ref('')
const showcaseAction = ref<'approve' | 'reject' | null>(null)
const rejectReason = ref('')
const isProcessing = ref(false)

const assignmentId = computed(() => route.params.id as string)

const submitTypeIcons: Record<string, any> = {
  complete: MousePointerClick,
  file: FileText,
  link: ExternalLink,
  image: ImageIcon,
}

onMounted(async () => {
  await loadData()
})

async function loadData() {
  const assignmentData = await findAssignmentById(assignmentId.value)
  if (!assignmentData) {
    router.push('/teacher')
    return
  }

  const courseData = await findCourseById(assignmentData.courseId)
  if (!courseData || courseData.teacherId !== authStore.profile?.id) {
    router.push('/teacher')
    return
  }

  assignment.value = assignmentData
  course.value = courseData
  await loadSubmissions()
}

async function loadSubmissions() {
  const subs = await getSubmissionsByAssignment(assignmentId.value)
  submissions.value = await Promise.all(
    subs.map(async (s) => ({
      ...s,
      student: (await findProfileById(s.studentId)) ?? undefined,
    }))
  )
}

function openFeedbackDialog(submission: Submission & { student?: Profile }) {
  selectedSubmission.value = submission
  feedback.value = submission.feedback || ''
  isFeedbackDialogOpen.value = true
}

function openShowcaseDialog(submission: Submission & { student?: Profile }, action: 'approve' | 'reject') {
  selectedSubmission.value = submission
  showcaseAction.value = action
  rejectReason.value = ''
  isShowcaseDialogOpen.value = true
}

async function handleSaveFeedback() {
  if (!selectedSubmission.value) return

  isProcessing.value = true

  try {
    await updateSubmissionFeedback(selectedSubmission.value.id, feedback.value)
    isFeedbackDialogOpen.value = false
    await loadSubmissions()
  } catch (e) {
    console.error('Failed to save feedback:', e)
  } finally {
    isProcessing.value = false
  }
}

async function handleShowcaseAction() {
  if (!selectedSubmission.value || !showcaseAction.value) return

  isProcessing.value = true

  try {
    await updateSubmissionShowcase(
      selectedSubmission.value.id,
      showcaseAction.value === 'approve',
      showcaseAction.value === 'reject' ? rejectReason.value : undefined,
    )
    isShowcaseDialogOpen.value = false
    await loadSubmissions()
  } catch (e) {
    console.error('Failed to update showcase status:', e)
  } finally {
    isProcessing.value = false
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div v-if="assignment && course" class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <Button variant="ghost" size="sm" @click="router.push(`/teacher/course/${course.id}`)">
          <ArrowLeft class="h-4 w-4 mr-2" />
          返回課程
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold mb-2">{{ assignment.title }}</h1>
        <p class="text-slate-600">{{ course.name }}</p>
      </div>

      <!-- Submissions List -->
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">
          學生提交
          <Badge variant="secondary" class="ml-2">
            {{ submissions.length }} 份
          </Badge>
        </h2>

        <div v-if="submissions.length === 0" class="text-center py-12 text-slate-500">
          <component :is="submitTypeIcons[assignment.submitType]" class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>尚無學生提交此作業</p>
        </div>
        <div v-else class="space-y-4">
          <Card
            v-for="submission in submissions"
            :key="submission.id"
          >
            <CardContent class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="font-semibold">{{ submission.student?.name || '未知學生' }}</h3>
                    <Badge :variant="submission.status === 'completed' ? 'success' : 'default'">
                      {{ submission.status === 'completed' ? '已完成' : '進行中' }}
                    </Badge>
                    <Badge v-if="submission.showcaseApproved" variant="success">
                      <Trophy class="h-3 w-3 mr-1" />
                      已展示
                    </Badge>
                  </div>
                  <p v-if="submission.submittedAt" class="text-sm text-slate-500 mb-2">
                    提交時間：{{ formatDate(submission.submittedAt) }}
                  </p>
                  <div v-if="submission.submitData" class="bg-slate-50 rounded-lg p-3 mb-3">
                    <p class="text-sm text-slate-700">{{ submission.submitData }}</p>
                    <a
                      v-if="assignment.submitType === 'link' && submission.submitData.startsWith('http')"
                      :href="submission.submitData"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
                    >
                      <ExternalLink class="h-3 w-3" />
                      查看連結
                    </a>
                  </div>
                  <div v-if="submission.feedback" class="bg-green-50 rounded-lg p-3">
                    <p class="text-sm text-green-700">
                      <span class="font-medium">您的評語：</span>
                      {{ submission.feedback }}
                    </p>
                  </div>
                </div>
                <div class="flex flex-col gap-2 ml-4">
                  <Button variant="outline" size="sm" @click="openFeedbackDialog(submission)">
                    {{ submission.feedback ? '修改評語' : '添加評語' }}
                  </Button>
                  <template v-if="assignment.showcaseEnabled">
                    <Button
                      v-if="!submission.showcaseApproved && !submission.showcaseRejected"
                      variant="outline"
                      size="sm"
                      class="text-green-600 hover:text-green-700 hover:bg-green-50"
                      @click="openShowcaseDialog(submission, 'approve')"
                    >
                      <Trophy class="h-4 w-4 mr-1" />
                      通過展示
                    </Button>
                    <Button
                      v-if="!submission.showcaseApproved && !submission.showcaseRejected"
                      variant="outline"
                      size="sm"
                      class="text-red-600 hover:text-red-700 hover:bg-red-50"
                      @click="openShowcaseDialog(submission, 'reject')"
                    >
                      <XCircle class="h-4 w-4 mr-1" />
                      拒絕展示
                    </Button>
                    <Badge v-if="submission.showcaseRejected" variant="destructive">
                      已拒絕展示
                    </Badge>
                  </template>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>

    <!-- Feedback Dialog -->
    <Dialog v-model:open="isFeedbackDialogOpen">
      <div class="space-y-4">
        <DialogHeader>
          <DialogTitle>
            {{ selectedSubmission?.feedback ? '修改評語' : '添加評語' }}
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="feedback">評語</Label>
            <Textarea
              id="feedback"
              v-model="feedback"
              placeholder="輸入對這份作業的評語..."
              :rows="4"
            />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isFeedbackDialogOpen = false">
              取消
            </Button>
            <Button
              :disabled="isProcessing"
              @click="handleSaveFeedback"
            >
              <Loader2 v-if="isProcessing" class="mr-2 h-4 w-4 animate-spin" />
              保存
            </Button>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Showcase Dialog -->
    <Dialog v-model:open="isShowcaseDialogOpen">
      <div class="space-y-4">
        <DialogHeader>
          <DialogTitle>
            {{ showcaseAction === 'approve' ? '通過作業展示' : '拒絕作業展示' }}
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="showcaseAction === 'reject'" class="space-y-2">
            <Label for="rejectReason">拒絕原因（選填）</Label>
            <Textarea
              id="rejectReason"
              v-model="rejectReason"
              placeholder="輸入拒絕原因..."
              :rows="3"
            />
          </div>
          <p v-else class="text-slate-600">
            確定要將這份作業展示在作業展示中心嗎？
          </p>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isShowcaseDialogOpen = false">
              取消
            </Button>
            <Button
              :variant="showcaseAction === 'reject' ? 'destructive' : 'default'"
              :disabled="isProcessing"
              @click="handleShowcaseAction"
            >
              <Loader2 v-if="isProcessing" class="mr-2 h-4 w-4 animate-spin" />
              {{ showcaseAction === 'approve' ? '通過' : '拒絕' }}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
