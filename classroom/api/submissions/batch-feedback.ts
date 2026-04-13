import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

  const body = await req.json()
  const { feedbacks } = body as {
    feedbacks: { submissionId: string; feedback: string }[]
  }

  if (!Array.isArray(feedbacks)) return errorResponse('feedbacks[] is required')

  let updated = 0
  for (const { submissionId, feedback } of feedbacks) {
    const { error } = await supabase
      .from('submissions')
      .update({ feedback })
      .eq('id', submissionId)

    if (!error) updated++
  }

  return jsonResponse({ updated })
}
