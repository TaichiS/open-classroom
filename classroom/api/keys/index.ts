import { createHash, randomBytes } from 'crypto'
import { verifySessionJwt, jsonResponse, errorResponse } from '../_lib/auth'
import { supabase } from '../_lib/supabase'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  // 使用 Supabase session JWT（非 API Key）
  const auth = await verifySessionJwt(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  const body = await req.json() as any
  const { label } = body
  if (!label || typeof label !== 'string') return errorResponse('label is required', 400)

  // 產生明文 key
  const prefix = auth.role === 'teacher' ? 'cl_teacher_' : 'cl_student_'
  const randomPart = randomBytes(24).toString('base64url').slice(0, 32)
  const plainKey = `${prefix}${randomPart}`

  // SHA-256 hash（不儲存明文）
  const keyHash = createHash('sha256').update(plainKey).digest('hex')

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: auth.userId,
      key_hash: keyHash,
      label,
      role: auth.role,
    })
    .select('id, label, role, created_at')
    .single()

  if (error) return errorResponse(error.message, 500)

  // 明文 key 只在此回傳一次
  return jsonResponse({ ...data, key: plainKey }, 201)
}
