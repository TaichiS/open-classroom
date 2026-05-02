<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import MarkdownEditor from '@/components/ui/MarkdownEditor.vue'
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
  BookOpen,
  LogOut,
  Plus,
  Users,
  Clock,
  CalendarDays,
  MousePointerClick,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Eye,
  Pencil,
  MessageSquare,
} from 'lucide-vue-next'
import {
  findCourseById,
  updateCourse,
  getAssignmentsByCourse,
  getMembersByCourse,
  findProfileById,
  saveAssignment,
  updateAssignment,
  deleteAssignment,
  getDiscussionCountsByAssignments,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Course, Assignment, SubmitType, CourseMember } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const course = ref<Course | null>(null)
const assignments = ref<Assignment[]>([])
const members = ref<CourseMember[]>([])
const memberNameMap = ref<Record<string, string>>({})
const isCreateDialogOpen = ref(false)
const isCreating = ref(false)
const discussionCountMap = ref<Record<string, number>>({})
const isLoading = ref(true)
const errorMessage = ref('')
const isEditingMaterial = ref(false)
const isSavingMaterial = ref(false)
const materialUrlInput = ref('')

// Edit state
const isEditDialogOpen = ref(false)
const editingAssignment = ref<Assignment | null>(null)
const isEditing = ref(false)
const editForm = ref({
  title: '',
  description: '',
  submitType: 'complete' as SubmitType,
  releaseDate: '',
  dueDate: '',
  showcaseEnabled: true,
  showcaseRequireApproval: true,
})

const newAssignment = ref({
  title: '',
  description: '',
  submitType: 'complete' as SubmitType,
  releaseDate: '',
  dueDate: '',
  showcaseEnabled: true,
  showcaseRequireApproval: true,
})

const courseId = computed(() => route.params.id as string)

const submitTypes: { value: SubmitType; label: string; icon: any }[] = [
  { value: 'complete', label: '點擊完成', icon: MousePointerClick },
  { value: 'file', label: '檔案上傳', icon: FileText },
  { value: 'link', label: '連結提交', icon: LinkIcon },
  { value: 'image', label: '圖片上傳', icon: ImageIcon },
]

onMounted(async () => {
  await loadData()
})

async function loadData() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!authStore.profile && authStore.user) {
      await authStore.refreshProfile()
    }

    if (!authStore.profile) {
      router.push('/login')
      return
    }

    const courseData = await findCourseById(courseId.value)
    if (!courseData || courseData.teacherId !== authStore.profile.id) {
      router.push('/teacher')
      return
    }

    course.value = courseData
    materialUrlInput.value = courseData.materialUrl ?? ''
    const [assignmentData, memberData] = await Promise.all([
      getAssignmentsByCourse(courseId.value),
      getMembersByCourse(courseId.value),
    ])
    assignments.value = assignmentData
    members.value = memberData
    discussionCountMap.value = await getDiscussionCountsByAssignments(assignments.value.map(a => a.id))
    await loadMemberNames()
  } catch (e) {
    console.error('Failed to load course detail:', e)
    errorMessage.value = '載入課程資料失敗，請重新整理或稍後再試。'
  } finally {
    isLoading.value = false
  }
}

async function loadMemberNames() {
  const entries = await Promise.all(
    members.value.map(async (m) => {
      const profile = await findProfileById(m.studentId)
      return [m.studentId, profile?.name ?? '未知學生'] as const
    })
  )
  memberNameMap.value = Object.fromEntries(entries)
}

function getStudentName(studentId: string): string {
  return memberNameMap.value[studentId] ?? '未知學生'
}

function getSubmitTypeInfo(submitType: SubmitType) {
  return submitTypes.find(t => t.value === submitType)
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

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function handleCreateAssignment() {
  if (!newAssignment.value.title.trim() || !course.value) return

  isCreating.value = true

  try {
    const maxOrderIndex = assignments.value.length > 0
      ? Math.max(...assignments.value.map(a => a.orderIndex))
      : -1

    const created = await saveAssignment({
      courseId: course.value.id,
      title: newAssignment.value.title.trim(),
      description: newAssignment.value.description.trim(),
      orderIndex: maxOrderIndex + 1,
      submitType: newAssignment.value.submitType,
      releaseDate: newAssignment.value.releaseDate
        ? new Date(newAssignment.value.releaseDate).toISOString()
        : new Date().toISOString(),
      dueDate: newAssignment.value.dueDate
        ? new Date(newAssignment.value.dueDate).toISOString()
        : undefined,
      isActive: true,
      showcaseEnabled: newAssignment.value.showcaseEnabled,
      showcaseRequireApproval: newAssignment.value.showcaseRequireApproval,
    })

    // Notify enrolled students via email
    supabase.functions.invoke('send-email', {
      body: { assignmentId: created.id, type: 'assignment_released' }
    }).catch(console.error) // Non-blocking: don't fail if email fails

    newAssignment.value = {
      title: '',
      description: '',
      submitType: 'complete',
      releaseDate: '',
      dueDate: '',
      showcaseEnabled: true,
      showcaseRequireApproval: true,
    }
    isCreateDialogOpen.value = false
    await loadData()
  } catch (e) {
    console.error('Failed to create assignment:', e)
  } finally {
    isCreating.value = false
  }
}

function openEditDialog(assignment: Assignment) {
  editingAssignment.value = assignment
  editForm.value = {
    title: assignment.title,
    description: assignment.description,
    submitType: assignment.submitType,
    releaseDate: toLocalDatetimeInput(assignment.releaseDate),
    dueDate: assignment.dueDate ? toLocalDatetimeInput(assignment.dueDate) : '',
    showcaseEnabled: assignment.showcaseEnabled,
    showcaseRequireApproval: assignment.showcaseRequireApproval,
  }
  isEditDialogOpen.value = true
}

async function handleEditAssignment() {
  if (!editForm.value.title.trim() || !editingAssignment.value) return

  isEditing.value = true
  try {
    await updateAssignment(editingAssignment.value.id, {
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim(),
      submitType: editForm.value.submitType,
      releaseDate: editForm.value.releaseDate
        ? new Date(editForm.value.releaseDate).toISOString()
        : editingAssignment.value.releaseDate,
      dueDate: editForm.value.dueDate
        ? new Date(editForm.value.dueDate).toISOString()
        : undefined,
      showcaseEnabled: editForm.value.showcaseEnabled,
      showcaseRequireApproval: editForm.value.showcaseRequireApproval,
    })
    isEditDialogOpen.value = false
    editingAssignment.value = null
    await loadData()
  } catch (e) {
    console.error('Failed to update assignment:', e)
  } finally {
    isEditing.value = false
  }
}

async function handleDeleteAssignment(assignmentId: string) {
  if (confirm('確定要刪除此作業嗎？此操作無法復原。')) {
    await deleteAssignment(assignmentId)
    await loadData()
  }
}

async function handleSaveMaterialUrl() {
  if (!course.value) return

  isSavingMaterial.value = true

  try {
    const materialUrl = materialUrlInput.value.trim()
    await updateCourse(course.value.id, { materialUrl })
    course.value = { ...course.value, materialUrl: materialUrl || undefined }
    materialUrlInput.value = materialUrl
    isEditingMaterial.value = false
  } catch (e) {
    console.error('Failed to update material URL:', e)
  } finally {
    isSavingMaterial.value = false
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
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="sm" @click="router.push('/teacher')">
            <ArrowLeft class="h-4 w-4 mr-2" />
            返回
          </Button>
          <div v-if="course" class="flex items-center gap-2">
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

    <main v-if="isLoading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="flex items-center justify-center text-slate-500">
        <Loader2 class="mr-2 h-5 w-5 animate-spin" />
        載入課程作業中...
      </div>
    </main>

    <main v-else-if="errorMessage" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        {{ errorMessage }}
      </div>
    </main>

    <!-- Main Content -->
    <main v-else-if="course" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Course Info -->
      <div class="mb-8">
        <p class="text-slate-600 mb-4">{{ course.description }}</p>
        <div class="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span class="flex items-center gap-1">
            <Users class="h-4 w-4" />
            {{ members.length }} 位學生
          </span>
          <Badge variant="secondary">課程碼：{{ course.courseCode }}</Badge>
        </div>
        <div class="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">教材連結</h2>
              <a
                v-if="course.materialUrl && !isEditingMaterial"
                :href="course.materialUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 break-all"
              >
                <ExternalLink class="h-3.5 w-3.5 shrink-0" />
                {{ course.materialUrl }}
              </a>
              <p v-else-if="!isEditingMaterial" class="mt-1 text-sm text-slate-500">
                尚未設定教材連結
              </p>
            </div>
            <Button v-if="!isEditingMaterial" variant="outline" size="sm" @click="isEditingMaterial = true">
              {{ course.materialUrl ? '修改連結' : '新增連結' }}
            </Button>
          </div>
          <div v-if="isEditingMaterial" class="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              v-model="materialUrlInput"
              type="url"
              placeholder="https://..."
              class="flex-1"
            />
            <div class="flex gap-2">
              <Button variant="outline" :disabled="isSavingMaterial" @click="isEditingMaterial = false">
                取消
              </Button>
              <Button :disabled="isSavingMaterial" @click="handleSaveMaterialUrl">
                <Loader2 v-if="isSavingMaterial" class="mr-2 h-4 w-4 animate-spin" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Students List -->
      <Card class="mb-8">
        <CardContent class="!p-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">學生名單</h2>
          <div v-if="members.length === 0" class="text-center py-4 text-slate-500 text-sm">
            尚無學生加入此課程
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <Badge
              v-for="member in members"
              :key="member.id"
              variant="outline"
            >
              {{ getStudentName(member.studentId) }}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <!-- Assignments -->
      <div class="space-y-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-semibold text-slate-900">課程作業</h2>
          <Button @click="isCreateDialogOpen = true">
            <Plus class="h-4 w-4 mr-2" />
            新增作業
          </Button>
        </div>

        <div v-if="assignments.length === 0" class="text-center py-16 text-slate-500">
          <BookOpen class="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p class="font-medium">此課程暫無作業</p>
          <p class="text-sm mt-1">點擊上方按鈕新增作業</p>
        </div>

        <div v-else class="space-y-3">
          <Card
            v-for="assignment in assignments"
            :key="assignment.id"
            class="hover:shadow-md transition-shadow duration-200"
          >
            <CardContent class="!p-5 lg:!p-6">
              <!-- Title row -->
              <div class="flex flex-wrap items-center gap-2 mb-3">
                <h3 class="font-semibold text-slate-900 text-base leading-snug">
                  {{ assignment.title }}
                </h3>
                <Badge v-if="assignment.submitType !== 'complete'" variant="outline" class="shrink-0">
                  <component
                    :is="getSubmitTypeInfo(assignment.submitType)?.icon"
                    class="h-3 w-3 mr-1"
                  />
                  {{ getSubmitTypeInfo(assignment.submitType)?.label }}
                </Badge>
              </div>

              <!-- Description preview -->
              <p
                v-if="assignment.description"
                class="text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-4"
              >{{ stripMarkdown(assignment.description) }}</p>

              <!-- Dates -->
              <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-4">
                <span class="flex items-center gap-1">
                  <CalendarDays class="h-3.5 w-3.5" />
                  發布：{{ formatDate(assignment.releaseDate) }}
                </span>
                <span v-if="assignment.dueDate" class="flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" />
                  截止：{{ formatDate(assignment.dueDate) }}
                </span>
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <router-link :to="`/teacher/discussion/${assignment.id}`">
                  <Button variant="ghost" size="sm" class="cursor-pointer">
                    <MessageSquare class="h-4 w-4 mr-1.5" />
                    討論區
                    <span v-if="discussionCountMap[assignment.id]" class="ml-1.5 bg-slate-100 text-slate-600 text-xs rounded-full px-1.5 py-0.5 font-medium leading-none">
                      {{ discussionCountMap[assignment.id] }}
                    </span>
                  </Button>
                </router-link>
                <router-link :to="`/teacher/submissions/${assignment.id}`">
                  <Button variant="outline" size="sm" class="cursor-pointer">
                    <Eye class="h-4 w-4 mr-1.5" />
                    查看提交
                  </Button>
                </router-link>
                <Button
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                  @click="openEditDialog(assignment)"
                >
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  @click="handleDeleteAssignment(assignment.id)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>

    <!-- Create Assignment Dialog -->
    <Dialog v-model:open="isCreateDialogOpen" class="max-w-5xl max-h-[90vh] overflow-y-auto">
      <div class="space-y-4">
        <DialogHeader>
          <DialogTitle>新增作業</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="title">作業標題</Label>
            <Input
              id="title"
              v-model="newAssignment.title"
              placeholder="輸入作業標題"
            />
          </div>
          <div class="space-y-2">
            <Label>作業描述</Label>
            <MarkdownEditor
              v-model="newAssignment.description"
              placeholder="支援 Markdown 格式，例如 **粗體**、`程式碼`、清單等"
              minHeight="320px"
            />
          </div>
          <div class="space-y-2">
            <Label>提交方式</Label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in submitTypes"
                :key="type.value"
                type="button"
                :class="[
                  'flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer',
                  newAssignment.submitType === type.value
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                ]"
                @click="newAssignment.submitType = type.value"
              >
                <component :is="type.icon" class="h-4 w-4" />
                <span class="text-sm">{{ type.label }}</span>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="releaseDate">發布時間</Label>
              <Input
                id="releaseDate"
                v-model="newAssignment.releaseDate"
                type="datetime-local"
              />
            </div>
            <div class="space-y-2">
              <Label for="dueDate">截止時間（選填）</Label>
              <Input
                id="dueDate"
                v-model="newAssignment.dueDate"
                type="datetime-local"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <input
                v-model="newAssignment.showcaseEnabled"
                type="checkbox"
                class="w-4 h-4"
              />
              啟用作業展示
            </Label>
            <Label v-if="newAssignment.showcaseEnabled" class="flex items-center gap-2 ml-6">
              <input
                v-model="newAssignment.showcaseRequireApproval"
                type="checkbox"
                class="w-4 h-4"
              />
              需要老師審核
            </Label>
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isCreateDialogOpen = false">取消</Button>
            <Button
              :disabled="!newAssignment.title.trim() || isCreating"
              @click="handleCreateAssignment"
            >
              <Loader2 v-if="isCreating" class="mr-2 h-4 w-4 animate-spin" />
              {{ isCreating ? '建立中...' : '建立' }}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Edit Assignment Dialog -->
    <Dialog v-model:open="isEditDialogOpen" class="max-w-5xl max-h-[90vh] overflow-y-auto">
      <div class="space-y-4">
        <DialogHeader>
          <DialogTitle>編輯作業</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="edit-title">作業標題</Label>
            <Input
              id="edit-title"
              v-model="editForm.title"
              placeholder="輸入作業標題"
            />
          </div>
          <div class="space-y-2">
            <Label>作業描述</Label>
            <MarkdownEditor
              v-model="editForm.description"
              placeholder="支援 Markdown 格式，例如 **粗體**、`程式碼`、清單等"
              minHeight="320px"
            />
          </div>
          <div class="space-y-2">
            <Label>提交方式</Label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in submitTypes"
                :key="type.value"
                type="button"
                :class="[
                  'flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer',
                  editForm.submitType === type.value
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                ]"
                @click="editForm.submitType = type.value"
              >
                <component :is="type.icon" class="h-4 w-4" />
                <span class="text-sm">{{ type.label }}</span>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="edit-releaseDate">發布時間</Label>
              <Input
                id="edit-releaseDate"
                v-model="editForm.releaseDate"
                type="datetime-local"
              />
            </div>
            <div class="space-y-2">
              <Label for="edit-dueDate">截止時間（選填）</Label>
              <Input
                id="edit-dueDate"
                v-model="editForm.dueDate"
                type="datetime-local"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <input
                v-model="editForm.showcaseEnabled"
                type="checkbox"
                class="w-4 h-4"
              />
              啟用作業展示
            </Label>
            <Label v-if="editForm.showcaseEnabled" class="flex items-center gap-2 ml-6">
              <input
                v-model="editForm.showcaseRequireApproval"
                type="checkbox"
                class="w-4 h-4"
              />
              需要老師審核
            </Label>
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isEditDialogOpen = false">取消</Button>
            <Button
              :disabled="!editForm.title.trim() || isEditing"
              @click="handleEditAssignment"
            >
              <Loader2 v-if="isEditing" class="mr-2 h-4 w-4 animate-spin" />
              {{ isEditing ? '儲存中...' : '儲存變更' }}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
