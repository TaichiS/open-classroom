export const config = { runtime: 'edge' }

export default async function handler(_req: Request): Promise<Response> {
  const envKeys = Object.keys(process.env).filter(k => k.startsWith('SUPABASE'))
  let supabaseStatus = 'not tested'
  let queryError: string | null = null

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return new Response(JSON.stringify({
        ok: false, error: 'Missing env vars', envKeys,
        SUPABASE_URL: !!url, SUPABASE_SERVICE_ROLE_KEY: !!key,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    supabaseStatus = 'initialized'
    const { error } = await client.from('profiles').select('id').limit(1)
    queryError = error?.message ?? null
  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false, error: String(err?.message ?? err), supabaseStatus, envKeys,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true, supabaseStatus, queryError, envKeys }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
