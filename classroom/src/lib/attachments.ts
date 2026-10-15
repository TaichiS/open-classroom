import { supabase } from '@/lib/supabase'
import type { AssignmentAttachment } from '@/types'

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
export const ATTACHMENT_ACCEPT = '.pdf,.md,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.wav,.mp4,.json,.py,.js,.ts,.yaml,.yml,.toml,.lock'

async function request<T>(params: Record<string, string> = {}, method = 'GET', body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('登入已失效，請重新登入')
  const response = await fetch(`/api/attachments?${new URLSearchParams(params)}`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let result
  try { result = await response.json() } catch { throw new Error('附件服務未回傳有效資料，請確認已部署附件 API') }
  if (!response.ok) throw new Error(result.error || '附件操作失敗')
  return result
}

export const listAttachments = (assignmentId: string) => request<AssignmentAttachment[]>({ assignmentId })
export const deleteAttachment = (id: string) => request({ id }, 'DELETE')
export const completeAttachment = (id: string) => request<AssignmentAttachment>({ id, action: 'complete' }, 'POST')

export async function uploadAttachment(assignmentId: string, file: File): Promise<AssignmentAttachment> {
  if (file.size < 1 || file.size > MAX_ATTACHMENT_SIZE) throw new Error(`${file.name}：檔案須介於 1 byte 與 25 MB 之間`)
  const { attachment, uploadUrl } = await request<{ attachment: AssignmentAttachment; uploadUrl: string }>({}, 'POST', {
    assignmentId, fileName: file.name, size: file.size,
  })
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT', headers: { 'Content-Type': attachment.mimeType, 'x-upsert': 'false' }, body: file,
    })
    if (!response.ok) throw new Error('檔案傳輸失敗')
    return await completeAttachment(attachment.id)
  } catch {
    throw new Error(`${file.name} 未確認完成。請在附件清單重試確認；若未成功傳輸，刪除後重新上傳。`)
  }
}

export async function downloadAttachment(id: string) {
  const result = await request<{ downloadUrl: string }>({ id, action: 'download' })
  // 由 Storage 的 Content-Disposition 下載，不在新分頁執行附件內容。
  const link = document.createElement('a')
  link.href = result.downloadUrl
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function formatFileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`
}
