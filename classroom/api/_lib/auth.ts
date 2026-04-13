import { createHash } from 'crypto'
import { supabase } from './supabase'

export interface AuthResult {
  userId: string
  role: string
}

export async function verifyApiKey(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const key = authHeader.slice(7).trim()
  if (!key.startsWith('cl_teacher_') && !key.startsWith('cl_student_')) return null

  const keyHash = createHash('sha256').update(key).digest('hex')

  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, role')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) return null

  // 更新最後使用時間（非同步，不等待）
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .then(() => {})

  return { userId: data.user_id, role: data.role }
}

export async function verifySessionJwt(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile) return null

  return { userId: data.user.id, role: profile.role }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}
