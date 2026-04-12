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
  Unlock,
  CheckCircle,
  Clock,
  MessageCircle,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  MousePointerClick,
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
      <div class="mb-6">
        <p class="text-slate-600">{{ course.description }}</p>
      </div>

      <div class="space-y-4">
        <h2 class="text-xl font-semibold">課程作業</h2>
        <div v-if="assignments.length === 0" class="text-center py-12 text-slate-500">
          <p>此課程暫無作業</p>
        </div>
        <div v-else class="space-y-4">
          <Card
            v-for="assignment in assignments"
            :key="assignment.id"
            :class="`transition-all ${assignment.isUnlocked ? 'cursor-pointer hover:shadow-md' : 'opacity-75'}`"
            @click="assignment.isUnlocked && router.push(`/assignment/${assignment.id}`)"
          >
            <CardContent class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-4">
                  <div class="mt-1">
                    <Unlock v-if="assignment.isUnlocked" class="h-5 w-5 text-green-600" />
                    <Lock v-else class="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-semibold">{{ assignment.title }}</h3>
                      <Badge :variant="getAssignmentStatusBadge(assignment).variant">
                        {{ getAssignmentStatusBadge(assignment).text }}
                      </Badge>
                    </div>
                    <p class="text-sm text-slate-600 mb-2">{{ assignment.description }}</p>
                    <div class="flex items-center gap-4 text-sm text-slate-500">
                      <span class="flex items-center gap-1">
                        <component :is="submitTypeIcons[assignment.submitType]" class="h-4 w-4" />
                        {{ submitTypeLabels[assignment.submitType] }}
                      </span>
                      <span v-if="assignment.dueDate" class="flex items-center gap-1">
                        <Clock class="h-4 w-4" />
                        截止：{{ new Date(assignment.dueDate).toLocaleDateString('zh-TW') }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <router-link
                    v-if="assignment.isUnlocked"
                    :to="`/discussion/${assignment.id}`"
                    @click.stop
                  >
                    <Button variant="ghost" size="sm">
                      <MessageCircle class="h-4 w-4 mr-1" />
                      討論區
                    </Button>
                  </router-link>
                  <Button v-else variant="ghost" size="sm" disabled>
                    <MessageCircle class="h-4 w-4 mr-1" />
                    討論區
                  </Button>
                  <CheckCircle
                    v-if="assignment.submission?.status === 'completed'"
                    class="h-5 w-5 text-green-600"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>
