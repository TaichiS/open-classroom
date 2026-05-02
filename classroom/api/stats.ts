export const config = { runtime: 'edge' }

import { verifyApiKey, jsonResponse, errorResponse, supabase, withErrorHandler } from './_lib/all'

export default withErrorHandler(async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId')
  if (!courseId) return errorResponse('courseId is required', 400)

  const [membersRes, assignmentsRes, discussionsRes] = await Promise.all([
    supabase.from('course_members').select('student_id').eq('course_id', courseId),
    supabase.from('assignments').select('id, title').eq('course_id', courseId).order('order_index'),
    supabase.from('discussion_messages').select('assignment_id').eq('course_id', courseId),
  ])

  if (membersRes.error) return errorResponse(membersRes.error.message, 500)
  if (assignmentsRes.error) return errorResponse(assignmentsRes.error.message, 500)

  const totalStudents = membersRes.data.length
  const assignments = assignmentsRes.data
  const totalAssignments = assignments.length

  const submissionsByAssignment = await Promise.all(
    assignments.map(async (a: { id: string; title: string }) => {
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', a.id)
        .eq('status', 'completed')

      const submitted = count ?? 0
      const pending = totalStudents - submitted

      return { assignmentId: a.id, title: a.title, submitted, pending }
    })
  )

  const discussionCounts: Record<string, number> = {}
  for (const row of (discussionsRes.data ?? [])) {
    discussionCounts[row.assignment_id] = (discussionCounts[row.assignment_id] ?? 0) + 1
  }
  const discussionsByAssignment = assignments.map((a: { id: string }) => ({
    assignmentId: a.id,
    count: discussionCounts[a.id] ?? 0,
  }))
  const assignmentsWithDiscussion = discussionsByAssignment.filter(d => d.count > 0).length

  const totalSubmissions = submissionsByAssignment.reduce((sum, a) => sum + a.submitted, 0)
  const maxPossible = totalStudents * totalAssignments
  const completionRate = maxPossible > 0 ? totalSubmissions / maxPossible : 0

  return jsonResponse({ totalStudents, totalAssignments, submissionsByAssignment, completionRate, discussionsByAssignment, assignmentsWithDiscussion })
})
