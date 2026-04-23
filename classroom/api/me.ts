import { verifyApiKey, jsonResponse, errorResponse, supabase, withErrorHandler } from './_lib/all.ts'

export default withErrorHandler(async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  const auth = await verifyApiKey(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', auth.userId)
    .single()

  if (error || !profile) return errorResponse('Profile not found', 404)

  const { data: user } = await supabase.auth.admin.getUserById(auth.userId)
  const email = user?.user?.email || ''

  return jsonResponse({ id: profile.id, name: profile.name, role: profile.role, email })
})
