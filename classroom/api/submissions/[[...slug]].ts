import { createHash } from 'crypto'
import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const rawSlug = url.pathname.replace(/^\/api\/submissions\/?/, '')
  const slug = rawSlug || ''

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  // PATCH /api/submissions/:id/feedback
  if (slug.endsWith('/feedback') && req.method === 'PATCH') {
    if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)
    const id = slug.replace('/feedback', '')
    const body = await req.json()
    if (typeof body.feedback !== 'string' || body.feedback === '')
      return errorResponse('feedback is required', 400)
    const { data, error } = await supabase
      .from('submissions')
      .update({ feedback: body.feedback })
      .eq('id', id)
      .select()
      .single()
    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data)
  }

  // POST /api/submissions/batch-feedback
  if (slug === 'batch-feedback') {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405)
    if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)
    const body = await req.json()
    const { feedbacks } = body as { feedbacks: { submissionId: string; feedback: string }[] }
    if (!Array.isArray(feedbacks)) return errorResponse('feedbacks[] is required', 400)
    const results = await Promise.all(
      feedbacks.map(({ submissionId, feedback }) =>
        supabase.from('submissions').update({ feedback }).eq('id', submissionId)
      )
    )
    const updated = results.filter(r => !r.error).length
    return jsonResponse({ updated })
  }

  // GET /api/submissions/mine
  if (slug === 'mine') {
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405)
    if (auth.role !== 'student') return errorResponse('Forbidden', 403)
    const courseId = url.searchParams.get('courseId')
    if (!courseId) return errorResponse('courseId is required', 400)
    const { data: assignments, error: aError } = await supabase
      .from('assignments')
      .select('id, title, order_index, is_active')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
    if (aError) return errorResponse(aError.message, 500)
    const assignmentIds = assignments.map((a: { id: string }) => a.id)
    if (assignmentIds.length === 0) return jsonResponse([])
    const { data: submissions, error: sError } = await supabase
      .from('submissions')
      .select('*')
      .eq('student_id', auth.userId)
      .in('assignment_id', assignmentIds)
    if (sError) return errorResponse(sError.message, 500)
    const submissionMap = Object.fromEntries(
      submissions.map((s: { assignment_id: string }) => [s.assignment_id, s])
    )
    const result = assignments.map((a: { id: string; title: string; order_index: number; is_active: boolean }) => ({
      assignment: a,
      submission: submissionMap[a.id] || null,
    }))
    return jsonResponse(result)
  }

  // GET /api/submissions  (teacher) or  POST /api/submissions (student)
  if (slug === '') {
    if (req.method === 'GET') {
      if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)
      const assignmentId = url.searchParams.get('assignmentId')
      if (!assignmentId) return errorResponse('assignmentId is required', 400)
      const { data: submissions, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
      if (error) return errorResponse(error.message, 500)
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
      if (!assignmentId) return errorResponse('assignmentId is required', 400)
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
      // 更新 current_assignment_index（非同步）
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

  return errorResponse('Not found', 404)
}
