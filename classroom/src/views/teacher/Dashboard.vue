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
  Key,
} from 'lucide-vue-next'
import {
  getCoursesByTeacher,
  getMembersByCourse,
  getAssignmentsByCourse,
  saveCourse,
  generateCourseCode,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Course } from '@/types'

interface ApiKey {
  id: string
  label: string
  role: string
  created_at: string
  last_used_at: string | null
}

const router = useRouter()
const authStore = useAuthStore()

const myCourses = ref<Course[]>([])
const studentCountMap = ref<Record<string, number>>({})
const assignmentCountMap = ref<Record<string, number>>({})
const isCreateDialogOpen = ref(false)
const isCreating = ref(false)
const createCourseError = ref('')

const newCourse = ref({
  name: '',
  description: '',
  materialUrl: '',
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
  createCourseError.value = ''

  try {
    await withTimeout(
      saveCourse({
        name: newCourse.value.name.trim(),
        description: newCourse.value.description.trim(),
        materialUrl: newCourse.value.materialUrl.trim() || undefined,
        courseCode: generateCourseCode(),
        teacherId: authStore.profile.id,
      }, authStore.session?.access_token),
      '建立課程逾時，請確認網路連線或 Supabase 狀態後再試。',
      35000
    )

    newCourse.value = { name: '', description: '', materialUrl: '' }
    isCreateDialogOpen.value = false
    await withTimeout(
      loadCourses(),
      '課程已送出，但重新載入列表逾時。請重新整理頁面確認結果。'
    )
  } catch (e) {
    console.error('Failed to create course:', e)
    createCourseError.value = getCreateCourseErrorMessage(e)
  } finally {
    isCreating.value = false
  }
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}

function getCreateCourseErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)

  if (message.includes('material_url') || message.includes('schema cache')) {
    return '建立失敗：Supabase 的 courses 表尚未新增 material_url 欄位。請先執行 migration 003_course_material_url.sql。'
  }

  return message || '建立課程失敗，請稍後再試。'
}

const isApiKeyDialogOpen = ref(false)
const apiKeys = ref<ApiKey[]>([])
const newKeyLabel = ref('')
const isGeneratingKey = ref(false)
const generatedKey = ref('')
const isCopied = ref(false)

async function loadApiKeys() {
  const { data } = await supabase
    .from('api_keys')
    .select('id, label, role, created_at, last_used_at')
    .order('created_at', { ascending: false })
  apiKeys.value = data || []
}

async function generateApiKey() {
  if (!newKeyLabel.value.trim()) return
  isGeneratingKey.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: newKeyLabel.value.trim() }),
    })
    const result = await res.json()
    if (res.ok) {
      generatedKey.value = result.key
      newKeyLabel.value = ''
      await loadApiKeys()
    }
  } finally {
    isGeneratingKey.value = false
  }
}

async function revokeApiKey(id: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await fetch(`/api/keys/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  })
  await loadApiKeys()
}

async function copyKey() {
  await navigator.clipboard.writeText(generatedKey.value)
  isCopied.value = true
  setTimeout(() => { isCopied.value = false }, 2000)
}

function openApiKeyDialog() {
  generatedKey.value = ''
  newKeyLabel.value = ''
  isApiKeyDialogOpen.value = true
  loadApiKeys()
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
          <Button variant="outline" size="sm" @click="openApiKeyDialog">
            <Key class="w-4 h-4 mr-1" />
            API Keys
          </Button>
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
          <div class="space-y-2">
            <Label for="courseMaterialUrl">教材連結</Label>
            <Input
              id="courseMaterialUrl"
              v-model="newCourse.materialUrl"
              type="url"
              placeholder="https://..."
            />
          </div>
          <div v-if="createCourseError" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ createCourseError }}
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

    <!-- API Key Management Dialog -->
    <Dialog v-model:open="isApiKeyDialogOpen">
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4">
          <DialogHeader>
            <DialogTitle>API Keys 管理</DialogTitle>
          </DialogHeader>

          <div class="mt-4">
            <Label>產生新 Key</Label>
            <div class="flex gap-2 mt-1">
              <Input v-model="newKeyLabel" placeholder="裝置名稱，例如：我的 MacBook" class="flex-1" />
              <Button :disabled="isGeneratingKey || !newKeyLabel.trim()" @click="generateApiKey">
                <Loader2 v-if="isGeneratingKey" class="w-4 h-4 animate-spin mr-1" />
                產生
              </Button>
            </div>
          </div>

          <div v-if="generatedKey" class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p class="text-sm font-medium text-yellow-800">請立即複製，之後無法再看到</p>
            <div class="flex gap-2 mt-2">
              <code class="flex-1 text-xs bg-white p-2 rounded border break-all">{{ generatedKey }}</code>
              <Button size="sm" variant="outline" @click="copyKey">
                {{ isCopied ? '已複製' : '複製' }}
              </Button>
            </div>
          </div>

          <div class="mt-4">
            <p class="text-sm font-medium text-gray-700">已產生的 Keys</p>
            <div v-if="apiKeys.length === 0" class="text-sm text-gray-400 mt-2">尚無 API Key</div>
            <div v-for="key in apiKeys" :key="key.id"
                 class="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p class="text-sm font-medium">{{ key.label }}</p>
                <p class="text-xs text-gray-400">
                  建立：{{ new Date(key.created_at).toLocaleDateString('zh-TW') }}
                  <span v-if="key.last_used_at">
                    · 最後使用：{{ new Date(key.last_used_at).toLocaleDateString('zh-TW') }}
                  </span>
                </p>
              </div>
              <Button size="sm" variant="outline" class="text-red-600 border-red-200 hover:bg-red-50"
                      @click="revokeApiKey(key.id)">
                撤銷
              </Button>
            </div>
          </div>

          <div class="mt-4 flex justify-end">
            <Button variant="outline" @click="isApiKeyDialogOpen = false">關閉</Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
