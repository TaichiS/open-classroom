export const config = { runtime: 'edge' }

// 診斷 endpoint：捕捉模組初始化錯誤
let supabaseClient: any = null
let initError: string | null = null

try {
  // 動態 import 避免模組層級崩潰
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    initError = `Missing env vars: SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!key}`
  } else {
    supabaseClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    initError = null
  }
} catch (err: any) {
  initError = `createClient threw: ${err?.message ?? String(err)}`
}

export default async function handler(_req: Request): Promise<Response> {
  const nodeVersion = process.version
  const envKeys = Object.keys(process.env).filter(k => k.startsWith('SUPABASE'))

  if (initError) {
    return new Response(JSON.stringify({
      ok: false,
      error: initError,
      nodeVersion,
      envKeys,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // 測試一個簡單 Supabase 查詢
  try {
    const { error } = await supabaseClient.from('profiles').select('id').limit(1)
    return new Response(JSON.stringify({
      ok: true,
      supabaseInit: 'success',
      queryError: error?.message ?? null,
      nodeVersion,
      envKeys,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: `query threw: ${err?.message ?? String(err)}`,
      nodeVersion,
      envKeys,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
