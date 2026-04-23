import { supabase } from './supabase'

export interface AuthResult {
  userId: string
  role: string
}

// Web Crypto API SHA-256（Edge Runtime 相容）
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyApiKey(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const key = authHeader.slice(7).trim()
  if (!key.startsWith('cl_teacher_') && !key.startsWith('cl_student_')) return null

  const keyHash = await sha256Hex(key)

  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, role')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) return null

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

type Handler = (req: Request) => Promise<Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (err) {
      console.error(`[${req.method} ${new URL(req.url).pathname}] Unhandled error:`, err)
      return errorResponse('Internal server error', 500)
    }
  }
}
