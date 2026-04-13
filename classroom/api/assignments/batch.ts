import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

interface AssignmentInput {
  title: string
  description: string
  orderIndex?: number
  submitType?: string
  releaseDate?: string
  dueDate?: string
  isActive?: boolean
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

  const body = await req.json()
  const { courseId, assignments } = body as { courseId: string; assignments: AssignmentInput[] }

  if (!courseId || !Array.isArray(assignments)) {
    return errorResponse('courseId and assignments[] are required')
  }

  const created: unknown[] = []
  const errors: { index: number; message: string }[] = []

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId,
        title: a.title,
        description: a.description,
        order_index: a.orderIndex ?? i,
        submit_type: a.submitType ?? 'complete',
        release_date: a.releaseDate ?? new Date().toISOString(),
        due_date: a.dueDate ?? null,
        is_active: a.isActive ?? false,
        showcase_enabled: false,
        showcase_require_approval: false,
      })
      .select()
      .single()

    if (error) {
      errors.push({ index: i, message: error.message })
    } else {
      created.push(data)
    }
  }

  return jsonResponse({ created, errors }, 201)
}
