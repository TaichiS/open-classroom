<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ArrowLeft,
  MessageCircle,
  Send,
  CornerDownRight,
  User,
} from 'lucide-vue-next'
import {
  findAssignmentById,
  findCourseById,
  getAssignmentsByCourse,
  getDiscussionsByAssignment,
  saveDiscussion,
  findMember,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Assignment, Course, DiscussionMessage } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const assignment = ref<Assignment | null>(null)
const course = ref<Course | null>(null)
const messages = ref<DiscussionMessage[]>([])
const newMessage = ref('')
const replyTo = ref<DiscussionMessage | null>(null)

const assignmentId = computed(() => route.params.id as string)
const isTeacher = computed(() => authStore.profile?.role === 'teacher')
const coursePath = computed(() => {
  if (!course.value) return isTeacher.value ? '/teacher' : '/'
  return isTeacher.value ? `/teacher/course/${course.value.id}` : `/course/${course.value.id}`
})

let channel: RealtimeChannel | null = null

onUnmounted(() => {
  if (channel) supabase.removeChannel(channel)
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  if (!authStore.profile) return

  const assignmentData = await findAssignmentById(assignmentId.value)
  if (!assignmentData) {
    router.push(isTeacher.value ? '/teacher' : '/')
    return
  }

  const courseData = await findCourseById(assignmentData.courseId)
  if (!courseData) {
    router.push(isTeacher.value ? '/teacher' : '/')
    return
  }

  if (isTeacher.value) {
    if (courseData.teacherId !== authStore.profile.id) {
      router.push('/teacher')
      return
    }
  } else {
    // Check if student has unlocked this assignment
    const member = await findMember(courseData.id, authStore.profile.id)
    const assignments = await getAssignmentsByCourse(courseData.id)
    const currentIndex = assignments.findIndex(a => a.id === assignmentData.id)

    if (currentIndex === -1 || !member || currentIndex > member.currentAssignmentIndex) {
      router.push(`/course/${courseData.id}`)
      return
    }
  }

  assignment.value = assignmentData
  course.value = courseData
  await loadMessages()
  subscribeRealtime(assignmentId.value)
}

async function loadMessages() {
  messages.value = await getDiscussionsByAssignment(assignmentId.value)
}

function subscribeRealtime(assignmentId: string) {
  channel = supabase
    .channel(`discussion:${assignmentId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'discussion_messages',
      filter: `assignment_id=eq.${assignmentId}`,
    }, async () => {
      messages.value = await getDiscussionsByAssignment(assignmentId)
    })
    .subscribe()
}

function getReplyMessages(parentId: string): DiscussionMessage[] {
  return messages.value.filter(m => m.parentId === parentId)
}

function getUserDisplayName(userId: string, userName: string, _userRole: string): string {
  if (course.value && userId === course.value.teacherId) {
    return `${userName} (老師)`
  }
  return userName
}

function startReply(message: DiscussionMessage) {
  replyTo.value = message
}

function cancelReply() {
  replyTo.value = null
}

async function handleSendMessage() {
  if (!newMessage.value.trim() || !authStore.profile || !assignment.value || !course.value) return

  await saveDiscussion({
    assignmentId: assignment.value.id,
    courseId: course.value.id,
    userId: authStore.profile.id,
    content: newMessage.value.trim(),
    parentId: replyTo.value?.id,
  })

  newMessage.value = ''
  replyTo.value = null
  // Realtime subscription handles reloading messages
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-TW', {
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
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <Button variant="ghost" size="sm" @click="router.push(coursePath)">
          <ArrowLeft class="h-4 w-4 mr-2" />
          返回課程
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card class="mb-6">
        <CardHeader>
          <div class="flex items-center gap-2 mb-2">
            <MessageCircle class="h-5 w-5 text-slate-600" />
            <span class="text-sm text-slate-600">討論區</span>
          </div>
          <CardTitle>{{ assignment.title }}</CardTitle>
        </CardHeader>
      </Card>

      <!-- Messages -->
      <div class="space-y-4 mb-6">
        <div v-if="messages.filter(m => !m.parentId).length === 0" class="text-center py-12 text-slate-500">
          <MessageCircle class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>尚無留言</p>
          <p class="text-sm">成為第一個發言的人吧！</p>
        </div>

        <div
          v-for="message in messages.filter(m => !m.parentId)"
          :key="message.id"
          class="bg-white rounded-lg border border-slate-200 p-4"
        >
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <User class="h-4 w-4 text-slate-600" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-sm">{{ getUserDisplayName(message.userId, message.userName, message.userRole) }}</span>
                <Badge v-if="message.userRole === 'teacher'" variant="default" class="text-xs">老師</Badge>
                <span class="text-xs text-slate-400">{{ formatDate(message.createdAt) }}</span>
              </div>
              <p class="text-slate-700 whitespace-pre-wrap">{{ message.content }}</p>
              <div class="mt-2">
                <Button variant="ghost" size="sm" @click="startReply(message)">
                  <CornerDownRight class="h-3 w-3 mr-1" />
                  回覆
                </Button>
              </div>
            </div>
          </div>

          <!-- Replies -->
          <div v-if="getReplyMessages(message.id).length > 0" class="mt-4 ml-11 space-y-3">
            <div
              v-for="reply in getReplyMessages(message.id)"
              :key="reply.id"
              class="bg-slate-50 rounded-lg p-3"
            >
              <div class="flex items-start gap-2">
                <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User class="h-3 w-3 text-slate-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-sm">{{ getUserDisplayName(reply.userId, reply.userName, reply.userRole) }}</span>
                    <Badge v-if="reply.userRole === 'teacher'" variant="default" class="text-xs">老師</Badge>
                    <span class="text-xs text-slate-400">{{ formatDate(reply.createdAt) }}</span>
                  </div>
                  <p class="text-slate-700 text-sm whitespace-pre-wrap">{{ reply.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <div v-if="replyTo" class="mb-3 p-2 bg-slate-50 rounded text-sm flex items-center justify-between">
          <span>回覆 {{ replyTo.userName }}</span>
          <Button variant="ghost" size="sm" @click="cancelReply">取消</Button>
        </div>
        <div class="flex gap-2">
          <Textarea
            v-model="newMessage"
            placeholder="輸入您的留言..."
            class="flex-1"
            :rows="2"
          />
          <Button class="self-end" @click="handleSendMessage" :disabled="!newMessage.trim()">
            <Send class="h-4 w-4 mr-2" />
            送出
          </Button>
        </div>
      </div>
    </main>
  </div>
</template>
