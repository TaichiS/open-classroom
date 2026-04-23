// 統一 API 依賴檔案 - 將所有必要的函數和變數合併到此檔案
import { createClient } from '@supabase/supabase-js'

// ==================== 認證相關 ====================

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

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

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

// ==================== 回應相關 ====================

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

// ==================== 錯誤處理包裝 ====================

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
