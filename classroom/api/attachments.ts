export const config = { runtime: 'edge' }

import { supabase, verifyApiKey, verifySessionJwt } from './_lib/all'
import { createAttachmentHandler } from './_lib/attachments'

export default createAttachmentHandler({
  db: supabase,
  authenticate: req => req.headers.get('Authorization')?.startsWith('Bearer cl_')
    ? verifyApiKey(req)
    : verifySessionJwt(req),
})
