import { verifyApiKey, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PATCH') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)
  if (auth.role !== 'teacher') return errorResponse('Forbidden', 403)

  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  const id = parts[parts.length - 1]

  const body = await req.json() as any

  // camelCase → snake_case 對應
  const mapping: Record<string, string> = {
    title: 'title', description: 'description', isActive: 'is_active',
    dueDate: 'due_date', releaseDate: 'release_date', submitType: 'submit_type',
    showcaseEnabled: 'showcase_enabled', showcaseRequireApproval: 'showcase_require_approval',
  }

  const updateData: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(mapping)) {
    if (camel in body) updateData[snake] = body[camel]
  }

  if (Object.keys(updateData).length === 0) return errorResponse('No valid fields to update')

  const { data, error } = await supabase
    .from('assignments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
}
