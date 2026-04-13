import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  if (req.method === 'GET') {
    if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

    const url = new URL(req.url)
    const assignmentId = url.searchParams.get('assignmentId')
    if (!assignmentId) return errorResponse('assignmentId is required')

    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)

    if (error) return errorResponse(error.message, 500)

    // 取得學生名稱
    const studentIds = [...new Set(submissions.map((s: { student_id: string }) => s.student_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', studentIds)

    const profileMap = Object.fromEntries(
      (profiles || []).map((p: { id: string; name: string }) => [p.id, p.name])
    )

    const result = submissions.map((s: Record<string, unknown>) => ({
      ...s,
      studentName: profileMap[s.student_id as string] || '未知學生',
    }))

    return jsonResponse(result)
  }

  if (req.method === 'POST') {
    if (auth.role !== 'student') return errorResponse('Forbidden', 403)

    const body = await req.json()
    const { assignmentId, submitData } = body

    if (!assignmentId) return errorResponse('assignmentId is required')

    // 取得作業的 courseId
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id, order_index')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return errorResponse('Assignment not found', 404)

    const { data, error } = await supabase
      .from('submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: auth.userId,
        status: 'completed',
        submit_data: submitData ?? null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    // 更新 course_members.current_assignment_index（非同步，不等待）
    supabase
      .from('course_members')
      .select('current_assignment_index')
      .eq('course_id', assignment.course_id)
      .eq('student_id', auth.userId)
      .single()
      .then(({ data: member }) => {
        if (!member) return
        const newIndex = Math.max(member.current_assignment_index, assignment.order_index + 1)
        supabase
          .from('course_members')
          .update({ current_assignment_index: newIndex })
          .eq('course_id', assignment.course_id)
          .eq('student_id', auth.userId)
          .then(() => {})
      })

    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}
