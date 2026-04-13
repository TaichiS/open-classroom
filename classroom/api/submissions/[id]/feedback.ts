import { verifyApiKey, jsonResponse, errorResponse } from '../../_lib/auth'
import { supabase } from '../../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PATCH') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  // /api/submissions/:id/feedback → id is second-to-last segment
  const id = parts[parts.length - 2]

  const body = await req.json()
  if (typeof body.feedback !== 'string' || body.feedback === '') return errorResponse('feedback is required')

  const { data, error } = await supabase
    .from('submissions')
    .update({ feedback: body.feedback })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
}
