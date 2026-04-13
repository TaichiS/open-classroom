import { verifyApiKey, jsonResponse, errorResponse } from './_lib/auth'
import { supabase } from './_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const assignmentId = url.searchParams.get('assignmentId')
    if (!assignmentId) return errorResponse('assignmentId is required', 400)

    // 取得作業的 course_id，並驗證使用者有存取權
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return errorResponse('Assignment not found', 404)

    const hasAccess = await checkCourseAccess(auth.userId, auth.role, assignment.course_id)
    if (!hasAccess) return errorResponse('Forbidden', 403)

    const { data: messages, error } = await supabase
      .from('discussion_messages')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 500)

    // 組裝巢狀結構：頂層訊息 + replies
    const topLevel = messages.filter((m: { parent_id: string | null }) => !m.parent_id)
    const replies = messages.filter((m: { parent_id: string | null }) => !!m.parent_id)

    const nested = topLevel.map((parent: Record<string, unknown>) => ({
      ...parent,
      replies: replies.filter((r: { parent_id: string }) => r.parent_id === parent.id),
    }))

    return jsonResponse(nested)
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { assignmentId, courseId, content, parentId } = body

    if (!assignmentId || !courseId || !content) {
      return errorResponse('assignmentId, courseId, and content are required', 400)
    }

    const hasAccess = await checkCourseAccess(auth.userId, auth.role, courseId)
    if (!hasAccess) return errorResponse('Forbidden', 403)

    // 取得使用者名稱
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', auth.userId)
      .single()

    const { data, error } = await supabase
      .from('discussion_messages')
      .insert({
        assignment_id: assignmentId,
        course_id: courseId,
        user_id: auth.userId,
        user_name: profile?.name || '使用者',
        user_role: auth.role,
        content,
        parent_id: parentId || null,
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}

async function checkCourseAccess(userId: string, role: string, courseId: string): Promise<boolean> {
  if (role === 'teacher') {
    const { data } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', userId)
      .single()
    return !!data
  } else {
    const { data } = await supabase
      .from('course_members')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', userId)
      .single()
    return !!data
  }
}
