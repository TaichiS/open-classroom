<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ArrowLeft,
  BookOpen,
  LogOut,
  Lock,
  CheckCircle2,
  Clock,
  CalendarDays,
  MessageCircle,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  MousePointerClick,
  ChevronRight,
} from 'lucide-vue-next'
import {
  findCourseById,
  getAssignmentsByCourse,
  findMember,
  findSubmission,
} from '@/lib/db'
import type { AssignmentWithStatus, Course, CourseMember, SubmitType } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const course = ref<Course | null>(null)
const assignments = ref<AssignmentWithStatus[]>([])
const member = ref<CourseMember | null>(null)

const courseId = computed(() => route.params.id as string)

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

onMounted(async () => {
  await loadData()
})

async function loadData() {
  if (!authStore.profile) return

  const courseData = await findCourseById(courseId.value)
  if (!courseData) {
    router.push('/')
    return
  }
  course.value = courseData

  member.value = await findMember(courseId.value, authStore.profile.id)

  const allAssignments = await getAssignmentsByCourse(courseId.value)

  assignments.value = await Promise.all(
    allAssignments.map(async (assignment, index) => {
      const submission = await findSubmission(assignment.id, authStore.profile!.id)
      const isReleased = new Date(assignment.releaseDate) <= new Date()
      const isUnlocked = index === 0 || (member.value ? index <= member.value.currentAssignmentIndex : false)

      return {
        ...assignment,
        submission: submission ?? undefined,
        isUnlocked: isReleased && isUnlocked,
      }
    })
  )
}

function getAssignmentStatusBadge(assignment: AssignmentWithStatus) {
  if (!assignment.isUnlocked) {
    return { variant: 'secondary' as const, text: '未解鎖' }
  }
  if (assignment.submission?.status === 'completed') {
    return { variant: 'success' as const, text: '已完成' }
  }
  if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) {
    return { variant: 'destructive' as const, text: '已逾期' }
  }
  return { variant: 'default' as const, text: '進行中' }
}

function stripMarkdown(text: string, maxLines = 5): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*+>]\s+/gm, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, maxLines)
    .join('\n')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div v-if="course" class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="sm" @click="router.push('/')">
            <ArrowLeft class="h-4 w-4 mr-2" />
            返回
          </Button>
          <div class="flex items-center gap-2">
            <BookOpen class="h-6 w-6 text-slate-900" />
            <span class="text-xl font-bold">{{ course.name }}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" @click="handleLogout">
          <LogOut class="h-4 w-4 mr-2" />
          登出
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <p class="text-slate-600">{{ course.description }}</p>
      </div>

      <div class="space-y-4">
        <h2 class="text-xl font-semibold text-slate-900 mb-2">課程作業</h2>

        <div v-if="assignments.length === 0" class="text-center py-16 text-slate-500">
          <BookOpen class="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p class="font-medium">此課程暫無作業</p>
        </div>

        <div v-else class="space-y-3">
          <Card
            v-for="assignment in assignments"
            :key="assignment.id"
            :class="`transition-shadow duration-200 ${assignment.isUnlocked ? 'cursor-pointer hover:shadow-md' : 'opacity-60'}`"
            @click="assignment.isUnlocked && router.push(`/assignment/${assignment.id}`)"
          >
            <CardContent class="p-5 lg:p-6">
              <!-- Title row -->
              <div class="flex items-start gap-3 mb-3">
                <!-- Lock / Complete icon -->
                <div class="mt-0.5 shrink-0">
                  <CheckCircle2
                    v-if="assignment.submission?.status === 'completed'"
                    class="h-5 w-5 text-green-600"
                  />
                  <Lock v-else-if="!assignment.isUnlocked" class="h-5 w-5 text-slate-400" />
                  <div v-else class="h-5 w-5 rounded-full border-2 border-slate-300" />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2 mb-1">
                    <h3 class="font-semibold text-slate-900 text-base leading-snug">
                      {{ assignment.title }}
                    </h3>
                    <Badge :variant="getAssignmentStatusBadge(assignment).variant" class="shrink-0">
                      {{ getAssignmentStatusBadge(assignment).text }}
                    </Badge>
                  </div>

                  <!-- Description preview -->
                  <p
                    v-if="assignment.description && assignment.isUnlocked"
                    class="text-sm text-slate-600 leading-relaxed whitespace-pre-line"
                  >{{ stripMarkdown(assignment.description) }}</p>
                  <p v-else-if="!assignment.isUnlocked" class="text-sm text-slate-400">
                    完成前一個作業後解鎖
                  </p>
                </div>

                <!-- Chevron for unlocked -->
                <ChevronRight v-if="assignment.isUnlocked" class="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              </div>

              <!-- Meta + actions (only when unlocked) -->
              <div
                v-if="assignment.isUnlocked"
                class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-4"
              >
                <!-- Dates + submit type -->
                <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span class="flex items-center gap-1">
                    <component :is="submitTypeIcons[assignment.submitType]" class="h-3.5 w-3.5" />
                    {{ submitTypeLabels[assignment.submitType] }}
                  </span>
                  <span class="flex items-center gap-1">
                    <CalendarDays class="h-3.5 w-3.5" />
                    發布：{{ formatDate(assignment.releaseDate) }}
                  </span>
                  <span v-if="assignment.dueDate" class="flex items-center gap-1">
                    <Clock class="h-3.5 w-3.5" />
                    截止：{{ formatDate(assignment.dueDate) }}
                  </span>
                </div>

                <!-- Discussion button -->
                <router-link :to="`/discussion/${assignment.id}`" @click.stop>
                  <Button variant="ghost" size="sm" class="cursor-pointer">
                    <MessageCircle class="h-4 w-4 mr-1.5" />
                    討論區
                  </Button>
                </router-link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>
