<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  ArrowLeft,
  Trophy,
  User,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-vue-next'
import {
  getMembersByStudent,
  findCourseById,
  getAssignmentsByCourse,
  getSubmissionsByAssignment,
  findProfileById,
} from '@/lib/db'
import type { ShowcaseItem } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const showcaseItems = ref<ShowcaseItem[]>([])

onMounted(async () => {
  await loadShowcaseItems()
})

async function loadShowcaseItems() {
  if (!authStore.profile) return

  const members = await getMembersByStudent(authStore.profile.id)
  const items: ShowcaseItem[] = []

  for (const member of members) {
    const course = await findCourseById(member.courseId)
    if (!course) continue

    const assignments = await getAssignmentsByCourse(member.courseId)

    for (const assignment of assignments) {
      if (!assignment.showcaseEnabled) continue

      const submissions = await getSubmissionsByAssignment(assignment.id)

      for (const submission of submissions) {
        if (!submission.showcaseApproved) continue

        const studentProfile = await findProfileById(submission.studentId)
        if (!studentProfile) continue

        items.push({
          submission: {
            ...submission,
            studentName: studentProfile.name,
            studentEmail: '',
          },
          assignment,
          course,
        })
      }
    }
  }

  // Sort by submission date, newest first
  showcaseItems.value = items.sort((a, b) => {
    const dateA = a.submission.submittedAt ? new Date(a.submission.submittedAt).getTime() : 0
    const dateB = b.submission.submittedAt ? new Date(b.submission.submittedAt).getTime() : 0
    return dateB - dateA
  })
}

function getSubmitTypeIcon(type: string) {
  switch (type) {
    case 'file':
      return FileText
    case 'image':
      return ImageIcon
    case 'link':
      return ExternalLink
    default:
      return CheckCircle
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="sm" @click="router.push('/')">
            <ArrowLeft class="h-4 w-4 mr-2" />
            返回
          </Button>
          <div class="flex items-center gap-2">
            <Trophy class="h-6 w-6 text-slate-900" />
            <span class="text-xl font-bold">作業展示中心</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold mb-2">優秀作業展示</h1>
        <p class="text-slate-600">這裡展示了各課程的優秀作業，供大家學習參考</p>
      </div>

      <div v-if="showcaseItems.length === 0" class="text-center py-16">
        <Trophy class="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <h3 class="text-lg font-medium text-slate-600 mb-2">暫無展示作業</h3>
        <p class="text-slate-500">老師尚未審核通過任何作業展示</p>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="item in showcaseItems"
          :key="item.submission.id"
          class="hover:shadow-lg transition-shadow"
        >
          <CardHeader>
            <div class="flex items-start justify-between">
              <div>
                <CardTitle class="text-lg mb-1">{{ item.assignment.title }}</CardTitle>
                <CardDescription>{{ item.course.name }}</CardDescription>
              </div>
              <component :is="getSubmitTypeIcon(item.assignment.submitType)" class="h-5 w-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <User class="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p class="text-sm font-medium">{{ item.submission.studentName }}</p>
                <p v-if="item.submission.submittedAt" class="text-xs text-slate-500">
                  {{ formatDate(item.submission.submittedAt) }}
                </p>
              </div>
            </div>

            <div v-if="item.submission.submitData" class="bg-slate-50 rounded-lg p-3">
              <p class="text-sm text-slate-600 line-clamp-3">{{ item.submission.submitData }}</p>
              <a
                v-if="item.assignment.submitType === 'link' && item.submission.submitData.startsWith('http')"
                :href="item.submission.submitData"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                <ExternalLink class="h-3 w-3" />
                查看連結
              </a>
            </div>

            <div v-if="item.submission.feedback" class="mt-4 p-3 bg-green-50 rounded-lg">
              <p class="text-sm text-green-700">
                <span class="font-medium">老師評語：</span>
                {{ item.submission.feedback }}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>
</template>
