<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import {
  LogOut,
  BookOpen,
  Plus,
  Loader2,
  Trophy,
} from 'lucide-vue-next'
import {
  findCourseByCode,
  getMembersByStudent,
  findCourseById,
  getAssignmentsByCourse,
  getSubmissionsByAssignment,
  saveMember,
  findMember,
} from '@/lib/db'
import type { Course, CourseMember } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const myCourses = ref<Course[]>([])
const courseProgressMap = ref<Record<string, number>>({})
const courseCode = ref('')
const isJoining = ref(false)
const joinError = ref('')
const joinSuccess = ref('')

const userName = computed(() => authStore.profile?.name || '學生')

onMounted(async () => {
  await loadCourses()
})

async function loadCourses() {
  if (!authStore.profile) return
  const members = await getMembersByStudent(authStore.profile.id)
  const courses = await Promise.all(
    members.map((m: CourseMember) => findCourseById(m.courseId))
  )
  myCourses.value = courses.filter((c): c is Course => c !== null)
  await loadCourseProgress(members)
}

async function loadCourseProgress(members: CourseMember[]) {
  if (!authStore.profile) return
  const studentId = authStore.profile.id
  const progressEntries = await Promise.all(
    members.map(async (m) => {
      const assignments = await getAssignmentsByCourse(m.courseId)
      if (assignments.length === 0) return [m.courseId, 0] as const
      const submissionLists = await Promise.all(
        assignments.map(a => getSubmissionsByAssignment(a.id))
      )
      const completed = submissionLists.filter((subs) =>
        subs.some(s => s.studentId === studentId && s.status === 'completed')
      ).length
      return [m.courseId, Math.round((completed / assignments.length) * 100)] as const
    })
  )
  courseProgressMap.value = Object.fromEntries(progressEntries)
}

function getCourseProgress(courseId: string): number {
  return courseProgressMap.value[courseId] ?? 0
}

async function handleJoinCourse() {
  if (!courseCode.value.trim() || !authStore.profile) return

  joinError.value = ''
  joinSuccess.value = ''
  isJoining.value = true

  try {
    const course = await findCourseByCode(courseCode.value.trim())
    if (!course) {
      joinError.value = '找不到該課程碼，請確認後重試'
      return
    }

    const existingMember = await findMember(course.id, authStore.profile.id)
    if (existingMember) {
      joinError.value = '您已經是這門課程的成員'
      return
    }

    await saveMember(course.id, authStore.profile.id)

    joinSuccess.value = `成功加入課程：${course.name}`
    courseCode.value = ''
    await loadCourses()
  } catch (e) {
    joinError.value = '加入課程時發生錯誤'
  } finally {
    isJoining.value = false
  }
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <BookOpen class="h-6 w-6 text-slate-900" />
          <span class="text-xl font-bold">作業管理系統</span>
        </div>
        <div class="flex items-center gap-4">
          <router-link to="/showcase">
            <Button variant="ghost" size="sm">
              <Trophy class="h-4 w-4 mr-2" />
              作業展示
            </Button>
          </router-link>
          <span class="text-sm text-slate-600">{{ userName }}</span>
          <Button variant="ghost" size="sm" @click="handleLogout">
            <LogOut class="h-4 w-4 mr-2" />
            登出
          </Button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Join Course Section -->
      <Card class="mb-8">
        <CardHeader>
          <CardTitle class="text-lg">加入課程</CardTitle>
          <CardDescription>輸入課程碼以加入新課程</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex gap-2">
            <Input
              v-model="courseCode"
              placeholder="輸入課程碼（如：MED001）"
              class="max-w-xs"
              @keyup.enter="handleJoinCourse"
            />
            <Button :disabled="isJoining || !courseCode.trim()" @click="handleJoinCourse">
              <Loader2 v-if="isJoining" class="mr-2 h-4 w-4 animate-spin" />
              <Plus v-else class="mr-2 h-4 w-4" />
              {{ isJoining ? '加入中...' : '加入' }}
            </Button>
          </div>
          <p v-if="joinError" class="text-sm text-red-600 mt-2">{{ joinError }}</p>
          <p v-if="joinSuccess" class="text-sm text-green-600 mt-2">{{ joinSuccess }}</p>
        </CardContent>
      </Card>

      <!-- My Courses -->
      <div>
        <h2 class="text-xl font-semibold mb-4">我的課程</h2>
        <div v-if="myCourses.length === 0" class="text-center py-12 text-slate-500">
          <BookOpen class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>您還沒有加入任何課程</p>
          <p class="text-sm">輸入課程碼加入課程開始學習吧！</p>
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="course in myCourses"
            :key="course.id"
            class="cursor-pointer hover:shadow-md transition-shadow"
            @click="router.push(`/course/${course.id}`)"
          >
            <CardHeader>
              <CardTitle class="text-lg">{{ course.name }}</CardTitle>
              <CardDescription class="line-clamp-2">{{ course.description }}</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-600">課程進度</span>
                  <span class="font-medium">{{ getCourseProgress(course.id) }}%</span>
                </div>
                <Progress :model-value="getCourseProgress(course.id)" />
              </div>
              <div class="mt-4 flex items-center justify-between">
                <Badge variant="secondary">課程碼：{{ course.courseCode }}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>
