import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const dir = await mkdtemp(join(tmpdir(), 'classroom-routing-tests-'))
try {
  // 隔離 CLI 設定與所有環境檔；測試內另封鎖對外 fetch。
  const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('../tests/routing.test.mjs', import.meta.url))], {
    stdio: 'inherit',
    env: {
      PATH: process.env.PATH, HOME: dir, TMPDIR: dir,
      SUPABASE_URL: 'https://routing-test.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
    },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
