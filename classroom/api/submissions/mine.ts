import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'student') return errorResponse('Forbidden', 403)

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId')
  if (!courseId) return errorResponse('courseId is required')

  const { data: assignments, error: aError } = await supabase
    .from('assignments')
    .select('id, title, order_index, is_active')
    .eq('course_id', courseId)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (aError) return errorResponse(aError.message, 500)

  const assignmentIds = assignments.map((a: { id: string }) => a.id)

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
