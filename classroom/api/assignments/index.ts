import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId')

  if (req.method === 'GET') {
    if (!courseId) return errorResponse('courseId is required')

    let query = supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    // 學生只看已釋出的
    if (auth.role === 'student') {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data)
  }

  if (req.method === 'POST') {
    if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

    const body = await req.json() as any
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: body.courseId,
        title: body.title,
        description: body.description,
        order_index: body.orderIndex ?? 0,
        submit_type: body.submitType ?? 'complete',
        release_date: body.releaseDate ?? new Date().toISOString(),
        due_date: body.dueDate ?? null,
        is_active: body.isActive ?? false,
        showcase_enabled: body.showcaseEnabled ?? false,
        showcase_require_approval: body.showcaseRequireApproval ?? false,
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}
