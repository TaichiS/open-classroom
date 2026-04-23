export const config = { runtime: 'edge' }

import { verifySessionJwt, jsonResponse, errorResponse, supabase, withErrorHandler } from '../_lib/all'

export default withErrorHandler(async function handler(req: Request): Promise<Response> {
  if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405)

  // 使用 Supabase session JWT（非 API Key）
  const auth = await verifySessionJwt(req)
  if (!auth) return errorResponse('Unauthorized', 401)

  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  const id = parts[parts.length - 1]

  // 只能刪除自己的 key（user_id 限制確保安全）
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ deleted: true })
})
