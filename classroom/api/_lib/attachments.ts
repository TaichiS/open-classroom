import type { SupabaseClient } from '@supabase/supabase-js'

export const ATTACHMENT_BUCKET = 'assignment-attachments'
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
const DOWNLOAD_TTL = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', mp4: 'video/mp4',
  json: 'application/json', py: 'text/plain', js: 'text/plain', ts: 'text/plain',
  yaml: 'text/plain', yml: 'text/plain', toml: 'text/plain', lock: 'text/plain',
}

type Auth = { userId: string; role: string }
type Dependencies = { db: SupabaseClient; authenticate: (req: Request) => Promise<Auth | null> }
class RequestError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
function validId(value: string | null, name: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new RequestError(`${name} 格式錯誤`)
  return value
}
function checkDb(error: { message: string } | null) {
  if (error) throw new RequestError('附件服務暫時無法使用，請確認已套用附件資料庫設定。', 503)
}
function publicFile(row: any) {
  return {
    id: row.id, assignmentId: row.assignment_id, fileName: row.file_name,
    size: Number(row.size), mimeType: row.mime_type, status: row.status, createdAt: row.created_at,
  }
}

export function createAttachmentHandler({ db, authenticate }: Dependencies) {
  const storage = db.storage.from(ATTACHMENT_BUCKET)

  async function authorize(assignmentId: string, auth: Auth, write: boolean) {
    const { data: assignment, error } = await db.from('assignments')
      .select('id, course_id, is_active, release_date, order_index').eq('id', assignmentId).maybeSingle()
    checkDb(error)
    if (!assignment) throw new RequestError('找不到作業', 404)
    const { data: course, error: courseError } = await db.from('courses')
      .select('teacher_id').eq('id', assignment.course_id).maybeSingle()
    checkDb(courseError)
    if (auth.role === 'teacher' && course?.teacher_id === auth.userId) return
    if (write || auth.role !== 'student') throw new RequestError('無權存取此作業附件', 403)
    const { data: member, error: memberError } = await db.from('course_members')
      .select('current_assignment_index').eq('course_id', assignment.course_id)
      .eq('student_id', auth.userId).maybeSingle()
    checkDb(memberError)
    if (!member || !assignment.is_active || !(Date.parse(assignment.release_date) <= Date.now())) {
      throw new RequestError('此作業尚未開放，或你不是此課程成員', 403)
    }
    // 與學生課程頁一致：以已發布作業的排序位置判斷解鎖，不把 order_index 當陣列索引。
    const { data: assignments, error: listError } = await db.from('assignments')
      .select('id').eq('course_id', assignment.course_id).eq('is_active', true).order('order_index')
    checkDb(listError)
    const index = (assignments ?? []).findIndex(a => a.id === assignmentId)
    if (index < 0 || index > member.current_assignment_index) throw new RequestError('請先完成前面的作業', 403)
  }

  return async (req: Request): Promise<Response> => {
    try {
      if (!['GET', 'POST', 'DELETE'].includes(req.method)) throw new RequestError('不支援此操作', 405)
      const auth = await authenticate(req)
      if (!auth) throw new RequestError('請先登入或設定有效的 API Key', 401)
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      const id = url.searchParams.get('id')

      // 列出某作業附件；學生只會看到上傳完成的檔案。
      if (req.method === 'GET' && !id && !action) {
        const assignmentId = validId(url.searchParams.get('assignmentId'), 'assignmentId')
        await authorize(assignmentId, auth, false)
        let query = db.from('assignment_attachments').select('*').eq('assignment_id', assignmentId)
        if (auth.role === 'student') query = query.eq('status', 'ready')
        const { data, error } = await query.order('created_at')
        checkDb(error)
        return reply((data ?? []).map(publicFile))
      }

      // 先建立待上傳記錄，再簽發只能寫入該檔案位置的 URL。
      if (req.method === 'POST' && !id && !action) {
        let body: any
        try { body = await req.json() } catch { throw new RequestError('請提供 JSON 格式資料') }
        const assignmentId = validId(body?.assignmentId, 'assignmentId')
        await authorize(assignmentId, auth, true)
        const name = body.fileName
        if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\x00-\x1f\x7f/\\]/.test(name)) {
          throw new RequestError('檔名須為 1–200 字，不可包含路徑或控制字元')
        }
        const extension = name.split('.').pop()!.toLowerCase()
        const mimeType = FILE_TYPES[extension]
        if (!name.includes('.') || !mimeType) throw new RequestError('不支援此檔案格式')
        if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > MAX_ATTACHMENT_SIZE) {
          throw new RequestError('單一附件須介於 1 byte 與 25 MB 之間')
        }
        const attachmentId = crypto.randomUUID()
        const storagePath = `${assignmentId}/${attachmentId}.${extension}`
        const { data: row, error } = await db.from('assignment_attachments').insert({
          id: attachmentId, assignment_id: assignmentId, file_name: name,
          size: body.size, mime_type: mimeType, storage_path: storagePath, status: 'pending',
        }).select().single()
        checkDb(error)
        const { data: signed, error: signError } = await storage.createSignedUploadUrl(storagePath, { upsert: false })
        if (signError || !signed) {
          const { error: cleanupError } = await db.from('assignment_attachments').delete().eq('id', attachmentId)
          checkDb(cleanupError)
          throw new RequestError('無法開始上傳，請稍後重試', 503)
        }
        return reply({ attachment: publicFile(row), uploadUrl: signed.signedUrl }, 201)
      }

      const attachmentId = validId(id, 'id')
      const { data: row, error } = await db.from('assignment_attachments').select('*').eq('id', attachmentId).maybeSingle()
      checkDb(error)
      if (!row) throw new RequestError('找不到附件', 404)
      await authorize(row.assignment_id, auth, req.method !== 'GET')

      if (req.method === 'POST' && action === 'complete') {
        if (row.status === 'ready') return reply(publicFile(row))
        if (row.status !== 'pending') throw new RequestError('附件正在刪除，無法完成上傳', 409)
        const { data: info, error: infoError } = await storage.info(row.storage_path)
        if (infoError || !info) throw new RequestError('檔案尚未上傳完成，可稍後重試確認', 409)
        if (Number(info.size) !== Number(row.size) || info.contentType?.split(';')[0] !== row.mime_type) {
          throw new RequestError('實際檔案大小或格式與上傳資料不符，請刪除後重新上傳', 409)
        }
        const { data: saved, error: saveError } = await db.from('assignment_attachments')
          .update({ status: 'ready' }).eq('id', row.id).eq('status', 'pending').select().maybeSingle()
        checkDb(saveError)
        if (!saved) throw new RequestError('附件狀態已變更，請重新整理', 409)
        return reply(publicFile(saved))
      }
      if (req.method === 'GET' && action === 'download') {
        if (row.status !== 'ready') throw new RequestError('附件尚未上傳完成或正在刪除', 409)
        const { data, error: signError } = await storage.createSignedUrl(row.storage_path, DOWNLOAD_TTL, { download: row.file_name })
        if (signError || !data) throw new RequestError('無法取得下載連結，請重試', 503)
        return reply({ ...publicFile(row), downloadUrl: data.signedUrl, expiresIn: DOWNLOAD_TTL })
      }
      if (req.method === 'DELETE' && !action) {
        // 先隱藏附件；若儲存服務失敗，保留記錄供教師重試，避免遺失清理依據。
        const { error: markError } = await db.from('assignment_attachments').update({ status: 'deleting' }).eq('id', row.id)
        checkDb(markError)
        const { error: removeError } = await storage.remove([row.storage_path])
        if (removeError) throw new RequestError('檔案刪除失敗，請重試刪除此附件', 503)
        const { error: deleteError } = await db.from('assignment_attachments').delete().eq('id', row.id)
        checkDb(deleteError)
        return reply({ id: row.id, deleted: true })
      }
      throw new RequestError('不支援此附件操作', 400)
    } catch (error) {
      if (error instanceof RequestError) return reply({ error: error.message }, error.status)
      // 不記錄請求 token 或 signed URL。
      console.error('附件服務發生未預期錯誤')
      return reply({ error: '附件服務發生錯誤，請稍後重試' }, 500)
    }
  }
}
