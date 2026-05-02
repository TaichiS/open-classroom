import { supabase } from '@/lib/supabase'
import type { Profile, Course, CourseMember, Assignment, Submission, DiscussionMessage } from '@/types'

// ─── Mappers: snake_case → camelCase ─────────────────────────────────────────
function toProfile(r: any): Profile {
  return { id: r.id, name: r.name, role: r.role, avatar: r.avatar ?? undefined, createdAt: r.created_at }
}
function toCourse(r: any): Course {
  return { id: r.id, name: r.name, description: r.description, materialUrl: r.material_url ?? undefined, coverImage: r.cover_image ?? undefined, courseCode: r.course_code, teacherId: r.teacher_id, createdAt: r.created_at }
}
function toMember(r: any): CourseMember {
  return { id: r.id, courseId: r.course_id, studentId: r.student_id, joinedAt: r.joined_at, currentAssignmentIndex: r.current_assignment_index }
}
function toAssignment(r: any): Assignment {
  return { id: r.id, courseId: r.course_id, title: r.title, description: r.description, orderIndex: r.order_index, submitType: r.submit_type, releaseDate: r.release_date, dueDate: r.due_date ?? undefined, isActive: r.is_active, createdAt: r.created_at, showcaseEnabled: r.showcase_enabled, showcaseRequireApproval: r.showcase_require_approval }
}
function toSubmission(r: any): Submission {
  return { id: r.id, assignmentId: r.assignment_id, studentId: r.student_id, status: r.status, submitData: r.submit_data ?? undefined, submittedAt: r.submitted_at ?? undefined, feedback: r.feedback ?? undefined, showcaseApproved: r.showcase_approved ?? undefined, showcaseRejected: r.showcase_rejected ?? undefined, showcaseRejectReason: r.showcase_reject_reason ?? undefined }
}
function toDiscussion(r: any): DiscussionMessage {
  return { id: r.id, assignmentId: r.assignment_id, courseId: r.course_id, userId: r.user_id, userName: r.profiles?.name ?? '', userRole: r.profiles?.role ?? 'student', content: r.content, parentId: r.parent_id ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at ?? undefined }
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
export async function findProfileById(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  return data ? toProfile(data) : null
}

export async function createProfile(profile: Omit<Profile, 'createdAt'>): Promise<void> {
  await supabase.from('profiles').insert({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar,
  })
}

// ─── Courses ──────────────────────────────────────────────────────────────────
export async function getCoursesByTeacher(teacherId: string): Promise<Course[]> {
  const { data } = await supabase.from('courses').select('*').eq('teacher_id', teacherId).order('created_at')
  return (data ?? []).map(toCourse)
}

export async function findCourseById(id: string): Promise<Course | null> {
  const { data } = await supabase.from('courses').select('*').eq('id', id).maybeSingle()
  return data ? toCourse(data) : null
}

export async function findCourseByCode(code: string): Promise<Course | null> {
  const { data } = await supabase.from('courses').select('*').eq('course_code', code.toUpperCase()).maybeSingle()
  return data ? toCourse(data) : null
}

export async function saveCourse(course: Omit<Course, 'id' | 'createdAt'>, accessToken?: string): Promise<Course> {
  if (!accessToken) throw new Error('登入狀態已失效，請重新登入後再試。')

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 30000)
  const response = await fetch('/api/courses', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: course.name,
      description: course.description,
      materialUrl: course.materialUrl,
      courseCode: course.courseCode,
    }),
  }).catch((e) => {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('建立課程 API 超過 30 秒沒有回應。')
    }
    throw e
  }).finally(() => {
    window.clearTimeout(timeoutId)
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '建立課程失敗')
  return toCourse(result)
}

export async function updateCourse(id: string, patch: Partial<Pick<Course, 'name' | 'description' | 'materialUrl' | 'coverImage'>>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.description !== undefined) update.description = patch.description
  if (patch.materialUrl !== undefined) update.material_url = patch.materialUrl || null
  if (patch.coverImage !== undefined) update.cover_image = patch.coverImage
  await supabase.from('courses').update(update).eq('id', id)
}

// ─── Course Members ───────────────────────────────────────────────────────────
export async function getMembersByCourse(courseId: string): Promise<CourseMember[]> {
  const { data } = await supabase.from('course_members').select('*').eq('course_id', courseId)
  return (data ?? []).map(toMember)
}

export async function getMembersByStudent(studentId: string): Promise<CourseMember[]> {
  const { data } = await supabase.from('course_members').select('*').eq('student_id', studentId)
  return (data ?? []).map(toMember)
}

export async function findMember(courseId: string, studentId: string): Promise<CourseMember | null> {
  const { data } = await supabase.from('course_members').select('*').eq('course_id', courseId).eq('student_id', studentId).maybeSingle()
  return data ? toMember(data) : null
}

export async function saveMember(courseId: string, studentId: string): Promise<void> {
  await supabase.from('course_members').insert({
    course_id: courseId,
    student_id: studentId,
    current_assignment_index: 0,
  })
}

export async function updateMemberProgress(courseId: string, studentId: string, index: number): Promise<void> {
  await supabase.from('course_members').update({ current_assignment_index: index }).eq('course_id', courseId).eq('student_id', studentId)
}

// ─── Assignments ──────────────────────────────────────────────────────────────
export async function getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
  const { data } = await supabase.from('assignments').select('*').eq('course_id', courseId).order('order_index')
  return (data ?? []).map(toAssignment)
}

export async function findAssignmentById(id: string): Promise<Assignment | null> {
  const { data } = await supabase.from('assignments').select('*').eq('id', id).maybeSingle()
  return data ? toAssignment(data) : null
}

export async function saveAssignment(assignment: Omit<Assignment, 'id' | 'createdAt'>): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').insert({
    course_id: assignment.courseId,
    title: assignment.title,
    description: assignment.description,
    order_index: assignment.orderIndex,
    submit_type: assignment.submitType,
    release_date: assignment.releaseDate,
    due_date: assignment.dueDate,
    is_active: assignment.isActive,
    showcase_enabled: assignment.showcaseEnabled,
    showcase_require_approval: assignment.showcaseRequireApproval,
  }).select().single()
  if (error) throw error
  return toAssignment(data)
}

export async function updateAssignment(id: string, patch: Partial<Omit<Assignment, 'id' | 'createdAt' | 'courseId' | 'orderIndex'>>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) update.title = patch.title
  if (patch.description !== undefined) update.description = patch.description
  if (patch.isActive !== undefined) update.is_active = patch.isActive
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate
  if (patch.showcaseEnabled !== undefined) update.showcase_enabled = patch.showcaseEnabled
  if (patch.showcaseRequireApproval !== undefined) update.showcase_require_approval = patch.showcaseRequireApproval
  await supabase.from('assignments').update(update).eq('id', id)
}

export async function deleteAssignment(id: string): Promise<void> {
  await supabase.from('assignments').delete().eq('id', id)
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export async function findSubmission(assignmentId: string, studentId: string): Promise<Submission | null> {
  const { data } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle()
  return data ? toSubmission(data) : null
}

export async function getSubmissionsByAssignment(assignmentId: string): Promise<Submission[]> {
  const { data } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId)
  return (data ?? []).map(toSubmission)
}

export async function upsertSubmission(submission: Omit<Submission, 'id'>): Promise<void> {
  await supabase.from('submissions').upsert({
    assignment_id: submission.assignmentId,
    student_id: submission.studentId,
    status: submission.status,
    submit_data: submission.submitData,
    submitted_at: submission.submittedAt,
  }, { onConflict: 'assignment_id,student_id' })
}

export async function updateSubmissionFeedback(id: string, feedback: string): Promise<void> {
  await supabase.from('submissions').update({ feedback }).eq('id', id)
}

export async function updateSubmissionShowcase(id: string, approved: boolean, rejectReason?: string): Promise<void> {
  await supabase.from('submissions').update({
    showcase_approved: approved,
    showcase_rejected: !approved,
    showcase_reject_reason: rejectReason ?? null,
  }).eq('id', id)
}

// ─── Discussions ──────────────────────────────────────────────────────────────
export async function getDiscussionsByAssignment(assignmentId: string): Promise<DiscussionMessage[]> {
  const { data } = await supabase
    .from('discussion_messages')
    .select('*, profiles(name, role)')
    .eq('assignment_id', assignmentId)
    .order('created_at')
  return (data ?? []).map(toDiscussion)
}

export async function saveDiscussion(message: {
  assignmentId: string
  courseId: string
  userId: string
  content: string
  parentId?: string
}): Promise<void> {
  await supabase.from('discussion_messages').insert({
    assignment_id: message.assignmentId,
    course_id: message.courseId,
    user_id: message.userId,
    content: message.content,
    parent_id: message.parentId,
  })
}

export async function updateProfile(id: string, name: string): Promise<void> {
  await supabase.from('profiles').update({ name }).eq('id', id)
}

export async function getDiscussionCountsByAssignments(assignmentIds: string[]): Promise<Record<string, number>> {
  if (assignmentIds.length === 0) return {}
  const { data } = await supabase
    .from('discussion_messages')
    .select('assignment_id')
    .in('assignment_id', assignmentIds)
  const counts: Record<string, number> = {}
  for (const row of (data ?? [])) {
    counts[row.assignment_id] = (counts[row.assignment_id] ?? 0) + 1
  }
  return counts
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function generateCourseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
