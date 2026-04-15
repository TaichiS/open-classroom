import { verifyApiKey, jsonResponse, errorResponse, supabase } from './_lib/all.ts'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  if (auth.role === 'teacher') {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('teacher_id', auth.userId)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data)
  } else {
    // student: 取已加入的課程
    const { data: members, error: memberError } = await supabase
      .from('course_members')
      .select('course_id')
      .eq('student_id', auth.userId)

    if (memberError) return errorResponse(memberError.message, 500)

    const courseIds = members.map((m: { course_id: string }) => m.course_id)
    if (courseIds.length === 0) return jsonResponse([])

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .in('id', courseIds)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data)
  }
}
