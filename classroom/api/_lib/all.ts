// 統一 API 依賴檔案 - 將所有必要的函數和變數合併到此檔案

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ==================== 認證相關 ====================

export interface AuthResult {
  userId: string
  role: string
}

// 環境變數配置（如果沒有設置，使用默認值）
const supabaseUrl = process.env.SUPABASE_URL || 'https://kzcmxwqklzrrmixjgesq.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Y2RydXBlcm1peGpnZXNxIiwicm9sZSI6Im5udWkiLCJwYXQiOjE3NzU3NTUsImV4cCI6MjA1MzY1NX0.s3zN26bOyF6fzsxLUg0ReiBZEIQRH2VojeI1nztqM28'

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

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
