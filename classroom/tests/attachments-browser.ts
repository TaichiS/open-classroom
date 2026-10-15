// 僅供本機互動測試。所有 HTTP 要求都由記憶體假服務處理，不使用真實帳戶或資料。
import { createApp, h } from 'vue'
import AssignmentAttachments from '../src/components/AssignmentAttachments.vue'
import { supabase } from '../src/lib/supabase'
import '../src/assets/index.css'

supabase.auth.getSession = async () => ({ data: { session: { access_token: 'local-test-only' } }, error: null }) as any
let files: any[] = []
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input, options = {}) => {
  const url = new URL(String(input), location.origin)
  if (url.pathname.startsWith('/test-upload/')) {
    const id = url.pathname.split('/').pop()
    const file = files.find(file => file.id === id)
    file.transferred = true
    return json({})
  }
  if (url.pathname !== '/api/attachments') throw new Error('隔離測試禁止外部連線')
  const id = url.searchParams.get('id')
  const action = url.searchParams.get('action')
  if (options.method === 'POST' && !id) {
    const body = JSON.parse(String(options.body))
    const file = { id: crypto.randomUUID(), ...body, mimeType: 'text/markdown', status: 'pending', createdAt: new Date().toISOString() }
    files.push(file)
    return json({ attachment: file, uploadUrl: `/test-upload/${file.id}` }, 201)
  }
  if (options.method === 'POST' && action === 'complete') {
    const file = files.find(file => file.id === id)
    if (!file.transferred) return json({ error: '檔案尚未完成' }, 409)
    file.status = 'ready'
    return json(file)
  }
  if (options.method === 'DELETE') { files = files.filter(file => file.id !== id); return json({ deleted: true }) }
  if (action === 'download') return json({ downloadUrl: 'data:text/plain,attachment-test' })
  return json(files)
}
createApp({ render: () => h('main', { class: 'max-w-2xl mx-auto p-4 space-y-4' }, [
  h('h1', { class: 'text-xl font-bold' }, '附件介面隔離測試'),
  h('p', '使用假資料，驗證多檔上傳、下載按鈕與刪除操作。'),
  h(AssignmentAttachments, { assignmentId: '00000000-0000-4000-8000-000000000001', editable: true }),
]) }).mount('#app')
