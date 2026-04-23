export const config = { runtime: 'edge' }

import { verifySessionJwt, jsonResponse, errorResponse, supabase, withErrorHandler } from '../_lib/all'

export default withErrorHandler(async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await verifySessionJwt(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  const body = await req.json() as any
  const { label } = body
  if (!label || typeof label !== 'string') return errorResponse('label is required', 400)

  // Web Crypto API 產生 random bytes
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const randomPart = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 32)

  const prefix = auth.role === 'teacher' ? 'cl_teacher_' : 'cl_student_'
  const plainKey = `${prefix}${randomPart}`

  // Web Crypto API SHA-256
  const data = new TextEncoder().encode(plainKey)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const keyHash = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: row, error } = await supabase
    .from('api_keys')
    .insert({ user_id: auth.userId, key_hash: keyHash, label, role: auth.role })
    .select('id, label, role, created_at')
    .single()

  if (error) return errorResponse(error.message, 500)

  // 明文 key 只在此回傳一次
  return jsonResponse({ ...row, key: plainKey }, 201)
})
