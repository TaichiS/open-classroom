import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Command } from '../cli/node_modules/commander/index.js'
import { createAttachmentHandler, MAX_ATTACHMENT_SIZE } from '../api/_lib/attachments.ts'
import { uploadFile, downloadFile, registerAttachments } from '../cli/commands/attachments.js'

// 測試只使用記憶體資料與可拋棄檔案；若意外發出真實 HTTP 請求，立即失敗。
globalThis.fetch = async () => { throw new Error('測試禁止外部網路連線') }
const assignmentId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const attachmentId = '00000000-0000-4000-8000-000000000003'

function fixture({ auth = { userId: 'teacher', role: 'teacher' }, active = true, release = '2020-01-01', member = true, progress = 0, previous = false } = {}) {
  const tables = {
    assignments: [ ...(previous ? [{ id: otherId, course_id: 'course', is_active: true, order_index: 3 }] : []),
      { id: assignmentId, course_id: 'course', is_active: active, release_date: release, order_index: 40 } ],
    courses: [{ id: 'course', teacher_id: 'teacher' }],
    course_members: member ? [{ course_id: 'course', student_id: 'student', current_assignment_index: progress }] : [],
    assignment_attachments: [],
  }
  const objects = new Map()
  const faults = {}
  const calls = []
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'select'; this.singleRow = false }
    select() { return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    order(key) { this.orderKey = key; return this }
    insert(data) { this.operation = 'insert'; this.value = data; return this }
    update(data) { this.operation = 'update'; this.value = data; return this }
    delete() { this.operation = 'delete'; return this }
    single() { this.singleRow = true; return this }
    maybeSingle() { this.singleRow = true; return this }
    then(resolve, reject) {
      try {
        calls.push(`${this.table}:${this.operation}`)
        if (faults[`${this.table}:${this.operation}`]) return Promise.resolve({ data: null, error: { message: '模擬失敗' } }).then(resolve, reject)
        let rows = tables[this.table].filter(row => this.filters.every(fn => fn(row)))
        if (this.operation === 'insert') {
          const row = { ...this.value, created_at: '2026-01-01' }; tables[this.table].push(row); rows = [row]
        } else if (this.operation === 'update') rows.forEach(row => Object.assign(row, this.value))
        else if (this.operation === 'delete') tables[this.table] = tables[this.table].filter(row => !rows.includes(row))
        if (this.orderKey) rows.sort((a, b) => a[this.orderKey] < b[this.orderKey] ? -1 : a[this.orderKey] > b[this.orderKey] ? 1 : 0)
        const data = this.singleRow ? rows[0] ?? null : rows
        return Promise.resolve({ data: structuredClone(data), error: null }).then(resolve, reject)
      } catch (error) { return Promise.reject(error).then(resolve, reject) }
    }
  }
  const storage = {
    async createSignedUploadUrl(path, options) { calls.push(['sign-upload', path, options]); return faults.sign ? { error: {} } : { data: { signedUrl: `https://storage.test/upload/${path}` }, error: null } },
    async info(path) { return objects.has(path) ? { data: objects.get(path), error: null } : { data: null, error: {} } },
    async createSignedUrl(path, ttl, options) { calls.push(['sign-download', path, ttl, options]); return { data: { signedUrl: 'https://storage.test/download' }, error: null } },
    async remove(paths) { if (faults.remove) return { error: {} }; paths.forEach(path => objects.delete(path)); return { error: null } },
  }
  const handler = createAttachmentHandler({ db: { from: name => new Query(name), storage: { from: () => storage } }, authenticate: async () => auth })
  const request = async (params = {}, method = 'GET', body) => {
    const response = await handler(new Request(`https://classroom.test/api/attachments?${new URLSearchParams(params)}`, {
      method, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }))
    return { status: response.status, data: await response.json(), headers: response.headers }
  }
  const seed = (status = 'ready') => {
    const row = { id: attachmentId, assignment_id: assignmentId, file_name: '教材.md', size: 3, mime_type: 'text/markdown', storage_path: `${assignmentId}/${attachmentId}.md`, status, created_at: '2026-01-01' }
    tables.assignment_attachments.push(row)
    return row
  }
  return { tables, objects, faults, calls, request, seed }
}

test('教師上傳、確認、列出、下載與刪除完整流程', async () => {
  const f = fixture()
  const start = await f.request({}, 'POST', { assignmentId, fileName: '課程.md', size: 3 })
  assert.equal(start.status, 201)
  assert.equal(start.data.attachment.status, 'pending')
  assert.equal(start.headers.get('Cache-Control'), 'no-store')
  const row = f.tables.assignment_attachments[0]
  assert.match(row.storage_path, new RegExp(`^${assignmentId}/[a-f0-9-]+\\.md$`))
  assert.equal((await f.request({ id: row.id, action: 'download' })).status, 409)
  assert.equal((await f.request({ id: row.id, action: 'complete' }, 'POST')).status, 409)
  f.objects.set(row.storage_path, { size: 3, contentType: 'text/markdown' })
  assert.equal((await f.request({ id: row.id, action: 'complete' }, 'POST')).data.status, 'ready')
  assert.equal((await f.request({ id: row.id, action: 'complete' }, 'POST')).status, 200)
  const list = await f.request({ assignmentId })
  assert.equal(list.data.length, 1)
  assert.equal(list.data[0].storage_path, undefined)
  assert.equal((await f.request({ id: row.id, action: 'download' })).status, 200)
  assert.deepEqual(f.calls.find(c => c[0] === 'sign-download').slice(2), [60, { download: '課程.md' }])
  assert.equal((await f.request({ id: row.id }, 'DELETE')).status, 200)
  assert.equal(f.objects.size, 0)
  assert.equal(f.tables.assignment_attachments.length, 0)
})

test('拒絕未登入與非課程教師，且不簽發任何連結', async () => {
  for (const auth of [null, { userId: 'other-teacher', role: 'teacher' }]) {
    const f = fixture({ auth }); f.seed()
    for (const [params, method, body] of [
      [{ assignmentId }, 'GET'], [{ id: attachmentId, action: 'download' }, 'GET'],
      [{}, 'POST', { assignmentId, fileName: 'a.pdf', size: 10 }], [{ id: attachmentId }, 'DELETE'],
    ]) assert.equal((await f.request(params, method, body)).status, auth ? 403 : 401)
    assert.equal(f.calls.some(c => Array.isArray(c)), false)
  }
})

test('學生僅可讀取所屬課程已開放、已解鎖的附件', async () => {
  const auth = { userId: 'student', role: 'student' }
  for (const options of [{ member: false }, { active: false }, { release: '2999-01-01' }, { previous: true }]) {
    const f = fixture({ auth, ...options }); f.seed()
    assert.equal((await f.request({ assignmentId })).status, 403)
    assert.equal((await f.request({ id: attachmentId, action: 'download' })).status, 403)
  }
  const f = fixture({ auth, previous: true, progress: 1 }); f.seed()
  assert.equal((await f.request({ assignmentId })).status, 200)
  assert.equal((await f.request({ id: attachmentId, action: 'download' })).status, 200)
  assert.equal((await f.request({ id: attachmentId }, 'DELETE')).status, 403)
  assert.equal((await f.request({ id: attachmentId, action: 'complete' }, 'POST')).status, 403)
  assert.equal((await f.request({}, 'POST', { assignmentId, fileName: 'a.pdf', size: 10 })).status, 403)
})

test('學生清單不顯示未完成或刪除中的檔案', async () => {
  const f = fixture({ auth: { userId: 'student', role: 'student' } })
  f.seed('pending'); f.seed('deleting')
  assert.deepEqual((await f.request({ assignmentId })).data, [])
})

test('驗證檔名、大小、ID 與 JSON；無效要求不建立上傳記錄', async () => {
  const f = fixture()
  for (const overrides of [{ fileName: '../a.pdf' }, { fileName: 'a\\b.pdf' }, { fileName: 'a\n.pdf' },
    { fileName: 'a.html' }, { fileName: 'a.exe' }, { fileName: 'a'.repeat(201) + '.pdf' }, { size: 0 },
    { size: -1 }, { size: 1.5 }, { size: MAX_ATTACHMENT_SIZE + 1 }, { size: '10' }, { assignmentId: 'bad' }, { assignmentId: [assignmentId] }]) {
    assert.equal((await f.request({}, 'POST', { assignmentId, fileName: 'a.pdf', size: 10, ...overrides })).status, 400)
  }
  assert.equal((await f.request({}, 'POST', '{')).status, 400)
  assert.equal((await f.request({}, 'POST', null)).status, 400)
  assert.equal(f.tables.assignment_attachments.length, 0)
})

test('實際大小或 MIME 不一致時不可確認上傳', async () => {
  for (const info of [{ size: 4, contentType: 'text/markdown' }, { size: 3, contentType: 'text/html' }]) {
    const f = fixture(); const row = f.seed('pending'); f.objects.set(row.storage_path, info)
    assert.equal((await f.request({ id: row.id, action: 'complete' }, 'POST')).status, 409)
    assert.equal(row.status, 'pending')
  }
})

test('簽發上傳失敗會回收待上傳記錄', async () => {
  const f = fixture(); f.faults.sign = true
  assert.equal((await f.request({}, 'POST', { assignmentId, fileName: 'a.pdf', size: 10 })).status, 503)
  assert.equal(f.tables.assignment_attachments.length, 0)
})

test('刪除失敗保留可重試記錄且停止提供下載', async () => {
  const f = fixture(); const row = f.seed(); f.faults.remove = true
  assert.equal((await f.request({ id: row.id }, 'DELETE')).status, 503)
  assert.equal(row.status, 'deleting')
  assert.equal((await f.request({ id: row.id, action: 'download' })).status, 409)
  assert.equal((await f.request({ id: row.id, action: 'complete' }, 'POST')).status, 409)
  f.faults.remove = false
  assert.equal((await f.request({ id: row.id }, 'DELETE')).status, 200)
})

test('資料庫故障不可被當成沒有附件', async () => {
  const f = fixture(); f.faults['assignment_attachments:select'] = true
  assert.equal((await f.request({ assignmentId })).status, 503)
})

async function withDirectory(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'classroom-attachments-test-'))
  try { await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

test('CLI 串流上傳中文檔名，傳輸不帶 API Key', async () => withDirectory(async dir => {
  const path = join(dir, '中文教材.md'); await writeFile(path, '# 教材')
  const calls = []
  const call = async (_path, opts) => {
    calls.push(opts)
    return opts.params ? { id: attachmentId, status: 'ready' }
      : { attachment: { id: attachmentId, mimeType: 'text/markdown' }, uploadUrl: 'https://storage.test/upload' }
  }
  const fetcher = async (url, opts) => {
    assert.equal(url, 'https://storage.test/upload')
    assert.equal(opts.headers.Authorization, undefined)
    const parts = []; for await (const chunk of opts.body) parts.push(chunk)
    assert.equal(Buffer.concat(parts).toString(), '# 教材')
    return new Response('{}')
  }
  assert.equal((await uploadFile(call, fetcher, assignmentId, path)).status, 'ready')
  assert.equal(calls[0].body.fileName, '中文教材.md')
  assert.equal(calls[1].params.action, 'complete')
}))

test('CLI 上傳失敗提供附件 ID，讓使用者重試或清理', async () => withDirectory(async dir => {
  const path = join(dir, 'a.md'); await writeFile(path, 'abc')
  const call = async () => ({ attachment: { id: attachmentId, mimeType: 'text/markdown' }, uploadUrl: 'https://storage.test/upload' })
  await assert.rejects(uploadFile(call, async () => new Response('', { status: 500 }), assignmentId, path), /未確認完成.*ID/)
}))

test('CLI 下載核對內容、不覆寫既有檔案，只有 --force 才覆寫', async () => withDirectory(async dir => {
  const target = join(dir, '教材.md')
  const call = async () => ({ id: attachmentId, fileName: '教材.md', size: 3, downloadUrl: 'https://storage.test/download' })
  const fetcher = async (_url, opts) => { assert.equal(opts.headers, undefined); return new Response('abc') }
  await downloadFile(call, fetcher, attachmentId, target)
  assert.equal(await readFile(target, 'utf8'), 'abc')
  await writeFile(target, 'original')
  await assert.rejects(downloadFile(call, fetcher, attachmentId, target), /已存在/)
  assert.equal(await readFile(target, 'utf8'), 'original')
  await downloadFile(call, fetcher, attachmentId, target, true)
  assert.equal(await readFile(target, 'utf8'), 'abc')
  assert.deepEqual(await readdir(dir), ['教材.md'])
}))

test('CLI 下載中斷與大小不符不留下半成品或破壞原檔', async () => withDirectory(async dir => {
  const target = join(dir, 'a.md'); await writeFile(target, 'original')
  const call = async () => ({ id: attachmentId, fileName: 'a.md', size: 3, downloadUrl: 'https://storage.test/download' })
  for (const body of ['a', 'abcd']) {
    await assert.rejects(downloadFile(call, async () => new Response(body), attachmentId, target, true), /大小|不完整/)
    assert.equal(await readFile(target, 'utf8'), 'original')
    assert.deepEqual(await readdir(dir), ['a.md'])
  }
}))

test('CLI 指令可解析 list、complete、delete，刪除須明確確認', async () => {
  const calls = []
  const make = () => {
    const program = new Command().exitOverride().configureOutput({ writeErr: () => {} })
    registerAttachments(program, { call: async (path, opts) => { calls.push({ path, ...opts }); return [] } })
    return program
  }
  await make().parseAsync(['attachments', 'list', '-a', assignmentId, '--json'], { from: 'user' })
  await make().parseAsync(['attachments', 'complete', attachmentId, '--json'], { from: 'user' })
  await assert.rejects(make().parseAsync(['attachments', 'delete', attachmentId], { from: 'user' }), /--yes/)
  await make().parseAsync(['attachments', 'delete', attachmentId, '--yes', '--json'], { from: 'user' })
  assert.deepEqual(calls.map(c => c.method ?? 'GET'), ['GET', 'POST', 'DELETE'])
})
