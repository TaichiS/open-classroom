import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const dir = await mkdtemp(join(tmpdir(), 'classroom-attachment-tests-'))
try {
  const outfile = join(dir, 'attachments.test.cjs')
  await build({
    entryPoints: [fileURLToPath(new URL('../tests/attachments.test.js', import.meta.url))],
    outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'warning',
  })
  // 不把真實 Supabase / CLI 設定注入測試程序。
  const result = spawnSync(process.execPath, ['--test', outfile], {
    stdio: 'inherit', env: { PATH: process.env.PATH, TMPDIR: dir },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally { await rm(dir, { recursive: true, force: true }) }
