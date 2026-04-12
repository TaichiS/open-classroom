<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  LogOut,
  BookOpen,
  Plus,
  Users,
  Loader2,
} from 'lucide-vue-next'
import {
  getCoursesByTeacher,
  getMembersByCourse,
  getAssignmentsByCourse,
  saveCourse,
  generateCourseCode,
} from '@/lib/db'
import type { Course } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const myCourses = ref<Course[]>([])
const studentCountMap = ref<Record<string, number>>({})
const assignmentCountMap = ref<Record<string, number>>({})
const isCreateDialogOpen = ref(false)
const isCreating = ref(false)

const newCourse = ref({
  name: '',
  description: '',
})

const userName = computed(() => authStore.profile?.name || '老師')

onMounted(async () => {
  await loadCourses()
})

async function loadCourses() {
  if (!authStore.profile) return
  myCourses.value = await getCoursesByTeacher(authStore.profile.id)
  await loadCourseCounts()
}

async function loadCourseCounts() {
  const counts = await Promise.all(
    myCourses.value.map(async (course) => {
      const [members, assignments] = await Promise.all([
        getMembersByCourse(course.id),
        getAssignmentsByCourse(course.id),
      ])
      return { id: course.id, students: members.length, assignments: assignments.length }
    })
  )
  counts.forEach(({ id, students, assignments }) => {
    studentCountMap.value[id] = students
    assignmentCountMap.value[id] = assignments
  })
}

function getStudentCount(courseId: string): number {
  return studentCountMap.value[courseId] ?? 0
}

function getAssignmentCount(courseId: string): number {
  return assignmentCountMap.value[courseId] ?? 0
}

async function handleCreateCourse() {
  if (!newCourse.value.name.trim() || !authStore.profile) return

  isCreating.value = true

  try {
    await saveCourse({
      name: newCourse.value.name.trim(),
      description: newCourse.value.description.trim(),
      courseCode: generateCourseCode(),
      teacherId: authStore.profile.id,
    })

    newCourse.value = { name: '', description: '' }
    isCreateDialogOpen.value = false
    await loadCourses()
  } catch (e) {
    console.error('Failed to create course:', e)
  } finally {
    isCreating.value = false
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
          <span class="text-xl font-bold">作業管理系統 - 教師端</span>
        </div>
        <div class="flex items-center gap-4">
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
      <!-- Create Course Button -->
      <div class="mb-8">
        <Button @click="isCreateDialogOpen = true">
          <Plus class="h-4 w-4 mr-2" />
          建立新課程
        </Button>
      </div>

      <!-- My Courses -->
      <div>
        <h2 class="text-xl font-semibold mb-4">我的課程</h2>
        <div v-if="myCourses.length === 0" class="text-center py-12 text-slate-500">
          <BookOpen class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>您還沒有建立任何課程</p>
          <p class="text-sm">點擊上方按鈕建立您的第一門課程！</p>
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="course in myCourses"
            :key="course.id"
            class="cursor-pointer hover:shadow-md transition-shadow"
            @click="router.push(`/teacher/course/${course.id}`)"
          >
            <CardHeader>
              <CardTitle class="text-lg">{{ course.name }}</CardTitle>
              <CardDescription class="line-clamp-2">{{ course.description }}</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="flex items-center gap-4 text-sm text-slate-600">
                <span class="flex items-center gap-1">
                  <Users class="h-4 w-4" />
                  {{ getStudentCount(course.id) }} 位學生
                </span>
                <span class="flex items-center gap-1">
                  <BookOpen class="h-4 w-4" />
                  {{ getAssignmentCount(course.id) }} 個作業
                </span>
              </div>
              <div class="mt-4">
                <Badge variant="secondary">課程碼：{{ course.courseCode }}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>

    <!-- Create Course Dialog -->
    <Dialog v-model:open="isCreateDialogOpen">
      <div class="space-y-4">
        <DialogHeader>
          <DialogTitle>建立新課程</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="courseName">課程名稱</Label>
            <Input
              id="courseName"
              v-model="newCourse.name"
              placeholder="輸入課程名稱"
            />
          </div>
          <div class="space-y-2">
            <Label for="courseDescription">課程描述</Label>
            <Textarea
              id="courseDescription"
              v-model="newCourse.description"
              placeholder="輸入課程描述"
              :rows="3"
            />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isCreateDialogOpen = false">
              取消
            </Button>
            <Button
              :disabled="!newCourse.name.trim() || isCreating"
              @click="handleCreateCourse"
            >
              <Loader2 v-if="isCreating" class="mr-2 h-4 w-4 animate-spin" />
              {{ isCreating ? '建立中...' : '建立' }}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
