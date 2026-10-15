import { open, mkdtemp, link, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { apiCall, printJson, printTable } from '../client.js'

// 只把 API Key 傳給 classroom；簽名傳輸 URL 不附帶使用者金鑰。
export async function uploadFile(call, fetcher, assignmentId, path) {
  const handle = await open(path, 'r')
  let attachment
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size < 1 || stat.size > 25 * 1024 * 1024) throw new Error(`${path}：須為 1 byte 至 25 MB 的一般檔案`)
    const result = await call('attachments', { method: 'POST', body: { assignmentId, fileName: basename(path), size: stat.size } })
    attachment = result.attachment
    const stream = handle.createReadStream({ autoClose: false })
    try {
      const response = await fetcher(result.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': attachment.mimeType, 'x-upsert': 'false' },
        body: stream, duplex: 'half', redirect: 'error',
      })
      if (!response.ok) throw new Error(`檔案傳輸失敗 (${response.status})`)
      await response.arrayBuffer()
    } finally { stream.destroy() }
    return await call('attachments', { method: 'POST', params: { id: attachment.id, action: 'complete' } })
  } catch (error) {
    if (attachment) throw new Error(`${basename(path)} 上傳未確認完成（ID：${attachment.id}）。可用 attachments complete 重試，或 delete 清理後再上傳。`, { cause: error })
    throw error
  } finally { await handle.close() }
}

export async function downloadFile(call, fetcher, id, output, force = false) {
  const data = await call('attachments', { params: { id, action: 'download' } })
  const safeName = basename(data.fileName.replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '_')
  if (!safeName || safeName === '.' || safeName === '..') throw new Error('附件檔名無效，請指定 --output')
  const target = resolve(output || safeName)
  const temporary = await mkdtemp(join(dirname(target), '.classroom-download-'))
  const temporaryFile = join(temporary, 'download')
  try {
    const response = await fetcher(data.downloadUrl, { redirect: 'error' })
    if (!response.ok || !response.body) throw new Error(`下載失敗 (${response.status})`)
    let received = 0
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length
        callback(received > data.size ? new Error('下載大小超過附件記錄') : null, chunk)
      },
    })
    const handle = await open(temporaryFile, 'wx', 0o600)
    try { await pipeline(Readable.fromWeb(response.body), counter, handle.createWriteStream()) }
    finally { await handle.close() }
    if (received !== data.size) throw new Error('下載不完整，未寫入目的檔案')
    if (force) await rename(temporaryFile, target)
    else {
      // link 是原子性的不覆寫操作，即使目的檔案在下載中途出現也不會被蓋掉。
      try { await link(temporaryFile, target) }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error(`目的檔案已存在：${target}；如需覆寫請加 --force`)
        throw error
      }
    }
    return { id: data.id, fileName: data.fileName, path: target, size: received }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

export function registerAttachments(program, { call = apiCall, fetcher = fetch } = {}) {
  const cmd = program.command('attachments').description('作業附件：上傳、下載與管理')
  cmd.command('list').alias('ls').description('列出某作業附件')
    .requiredOption('-a, --assignment <id>', '作業 ID').option('--json', '輸出 JSON')
    .action(async opts => {
      const data = await call('attachments', { params: { assignmentId: opts.assignment } })
      if (opts.json) return printJson(data)
      printTable(data, [{ key: 'id', label: 'ID' }, { key: 'fileName', label: '檔名' }, { key: 'size', label: 'Bytes' }, { key: 'status', label: '狀態' }])
    })
  cmd.command('upload').description('上傳一個或多個附件（教師，每檔最多 25 MB）')
    .requiredOption('-a, --assignment <id>', '作業 ID')
    .requiredOption('-f, --file <paths...>', '檔案路徑，可指定多個').option('--json', '輸出 JSON')
    .action(async opts => {
      const uploaded = [], errors = []
      for (const path of opts.file) {
        try { uploaded.push(await uploadFile(call, fetcher, opts.assignment, path)) }
        catch (error) { errors.push({ path, error: error.message }) }
      }
      if (opts.json) printJson({ uploaded, errors })
      else {
        for (const file of uploaded) console.log(`已上傳：${file.fileName} [${file.id}]`)
        for (const error of errors) console.error(`${error.path}：${error.error}`)
      }
      if (errors.length) process.exitCode = 1
    })
  cmd.command('download <id>').description('下載附件，預設不覆寫既有檔案')
    .option('-o, --output <path>', '目的檔案路徑').option('--force', '允許覆寫目的檔案')
    .option('--json', '輸出 JSON')
    .action(async (id, opts) => {
      const data = await downloadFile(call, fetcher, id, opts.output, opts.force)
      if (opts.json) printJson(data)
      else console.log(`已下載：${data.path}`)
    })
  cmd.command('complete <id>').description('重試確認已傳輸完成的附件（教師）').option('--json', '輸出 JSON')
    .action(async (id, opts) => {
      const data = await call('attachments', { method: 'POST', params: { id, action: 'complete' } })
      if (opts.json) printJson(data)
      else console.log(`已確認：${data.fileName} [${data.id}]`)
    })
  cmd.command('delete <id>').description('永久刪除附件（教師）').requiredOption('--yes', '確認刪除')
    .option('--json', '輸出 JSON').action(async (id, opts) => {
      const data = await call('attachments', { method: 'DELETE', params: { id } })
      if (opts.json) printJson(data)
      else console.log(`已刪除附件：${id}`)
    })
}
