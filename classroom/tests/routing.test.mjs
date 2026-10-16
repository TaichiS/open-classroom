import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = join(root, 'cli/index.js')
const exec = promisify(execFile)
const originalFetch = globalThis.fetch
const assignmentId = '00000000-0000-4000-8000-000000000001'
let server, baseUrl
const updates = []
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })

before(async () => {
  assert.equal(process.env.SUPABASE_URL, 'https://routing-test.invalid')
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    if (url.origin !== 'https://routing-test.invalid') throw new Error(`Blocked external request: ${url.origin}`)
    if (url.pathname === '/rest/v1/api_keys' && request.method === 'GET') {
      return json({ user_id: 'test-teacher', role: 'teacher' })
    }
    if (url.pathname === '/rest/v1/api_keys' && request.method === 'PATCH') return new Response(null, { status: 204 })
    if (url.pathname === '/rest/v1/assignments' && request.method === 'PATCH') {
      assert.equal(url.searchParams.get('id'), `eq.${assignmentId}`)
      const body = await request.json()
      updates.push(body)
      return json({ id: assignmentId, ...body })
    }
    throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`)
  }
  server = await createServer({
    root, configFile: join(root, 'vite.config.ts'), envDir: homedir(),
    logLevel: 'silent', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  })
  await server.listen()
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  await writeFile(join(homedir(), '.classroom-cli.json'), JSON.stringify({ baseUrl, apiKey: 'cl_teacher_fixture' }))
})

after(async () => {
  await server?.close()
  globalThis.fetch = originalFetch
})

test('動態與靜態 API 都到達驗證層，未知 API 回傳 JSON 404', async () => {
  for (const [method, path, status] of [
    ['PATCH', `/assignments/${assignmentId}`, 401],
    ['GET', `/assignments/${assignmentId}`, 405],
    ['DELETE', '/keys/test-key', 401],
    ['PATCH', '/submissions/test-submission/feedback', 401],
    ['POST', '/assignments/batch', 401],
    ['GET', '/attachments', 401],
    ['PATCH', '/unknown/path', 404],
  ]) {
    const response = await fetch(`${baseUrl}/api${path}`, { method })
    assert.equal(response.status, status, `${method} ${path}`)
    assert.match(response.headers.get('content-type'), /application\/json/)
    assert.equal(typeof (await response.json()).error, 'string')
  }
})

test('本機路由接受有無前導斜線，且靜態 batch 優先於動態 id', async () => {
  const router = await server.ssrLoadModule(join(root, 'api/_router.ts'))
  assert.equal(await router.findHandler(`assignments/${assignmentId}`), await router.findHandler(`/assignments/${assignmentId}`))
  assert.notEqual(await router.findHandler('/assignments/batch'), await router.findHandler(`/assignments/${assignmentId}`))
})

test('CLI 更新沿用 PATCH 動態端點並正確傳遞發布與取消發布', async () => {
  for (const [flag, isActive] of [['--active', true], ['--inactive', false]]) {
    const { stdout, stderr } = await exec(process.execPath, [cli, 'assignments', 'update', assignmentId, '--title', '測試作業', flag, '--json'], { env: process.env })
    assert.equal(stderr, '')
    assert.deepEqual(JSON.parse(stdout), { id: assignmentId, title: '測試作業', is_active: isActive })
  }
  assert.deepEqual(updates, [{ title: '測試作業', is_active: true }, { title: '測試作業', is_active: false }])
})

test('Vercel SPA fallback 排除 API，但保留首頁與前端深層連結', async () => {
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'))
  const fallback = config.rewrites.find(route => route.destination === '/index.html')
  const pattern = new RegExp(`^${fallback.source}$`)
  for (const path of ['/api', '/api/', '/api/assignments', `/api/assignments/${assignmentId}`, '/api/submissions/id/feedback']) {
    assert.equal(pattern.test(path), false, path)
  }
  for (const path of ['/', '/login', '/teacher/course/123', '/api-guide']) assert.equal(pattern.test(path), true, path)
  const response = await fetch(`${baseUrl}/login`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/html/)
})

test('CLI 遇到空白或 HTML 回應時提供方法、路徑、狀態碼且不洩漏憑證', async () => {
  let mode = 'empty'
  const stub = createHttpServer((req, res) => {
    assert.equal(req.method, 'PATCH')
    assert.equal(req.url, `/api/assignments/${assignmentId}`)
    req.resume()
    res.writeHead(mode === 'empty' ? 405 : 200, { 'Content-Type': 'text/html' })
    res.end(mode === 'empty' ? '' : '<html>private-response</html>')
  })
  await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve))
  try {
    await writeFile(join(homedir(), '.classroom-cli.json'), JSON.stringify({ baseUrl: `http://127.0.0.1:${stub.address().port}`, apiKey: 'cl_teacher_secret_fixture' }))
    for (mode of ['empty', 'html']) {
      await assert.rejects(exec(process.execPath, [cli, 'assignments', 'update', assignmentId, '--active'], { env: process.env }), error => {
        assert.equal(error.code, 1)
        assert.match(error.stderr, new RegExp(`API 回傳非 JSON \\[${mode === 'empty' ? 405 : 200}\\]：PATCH /api/assignments/${assignmentId}`))
        assert.doesNotMatch(error.stderr, /secret_fixture|private-response|附件 API/)
        return true
      })
    }
  } finally {
    await new Promise(resolve => stub.close(resolve))
  }
})
