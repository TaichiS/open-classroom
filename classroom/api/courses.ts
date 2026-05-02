export const config = { runtime: 'edge' }

import { verifyApiKey, verifySessionJwt, jsonResponse, errorResponse, supabase, withErrorHandler } from './_lib/all'

export default withErrorHandler(async function handler(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    const auth = await verifySessionJwt(req)
    if (!auth) return errorResponse('Unauthorized', 401)
    if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

    const body = await req.json() as {
      name?: string
      description?: string
      materialUrl?: string
      courseCode?: string
    }

    if (!body.name?.trim() || !body.courseCode?.trim()) {
      return errorResponse('name and courseCode are required')
    }

    const insert: Record<string, unknown> = {
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      course_code: body.courseCode.trim(),
      teacher_id: auth.userId,
    }

    if (body.materialUrl?.trim()) {
      insert.material_url = body.materialUrl.trim()
    }

    const { data, error } = await supabase
      .from('courses')
      .insert(insert)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data, 201)
  }

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
})
