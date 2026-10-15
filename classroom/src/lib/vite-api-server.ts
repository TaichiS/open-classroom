import path from 'path'
import { fileURLToPath } from 'node:url'
import { loadEnv, type Plugin } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 載入 API 索引
let apiIndex: any = null
let warmupComplete = false

export default function apiMiddleware(): Plugin {
  return {
    name: 'api-middleware',
    async configureServer(server) {
      // API 專用設定只放在開發伺服器程序，不以 VITE_ 或 define 暴露給瀏覽器。
      const env = loadEnv(server.config.mode, server.config.envDir, 'SUPABASE_')
      for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
        if (!process.env[key] && env[key]) process.env[key] = env[key]
      }
      server.middlewares.use(async (req, res, next) => {
        // 只處理 /api/* 路由
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        console.log(`🔵 API 請求: ${req.method} ${req.url}`)

        try {
          // 首次請求時預熱快取
          if (!warmupComplete) {
            console.log('🔥 預熱 API 快取...')
            const indexPath = path.join(__dirname, '..', '..', 'api', '_router.ts')
            const indexModule = await server.ssrLoadModule(indexPath)
            apiIndex = indexModule
            await apiIndex.warmupCache()
            warmupComplete = true
          }

          // 解析 URL 和路徑
          const url = new URL(req.url, `http://${req.headers.host}`)
          const pathname = url.pathname

          // 移除 /api 前綴
          const apiPath = pathname.slice(5) // 移除 '/api'

          // 使用索引找到處理器
          const handler = await apiIndex.findHandler(apiPath)

          if (!handler || typeof handler !== 'function') {
            console.log(`❌ 找不到處理器: ${apiPath}`)
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          console.log(`✅ 找到處理器: ${apiPath}`)

          // 建構 Request 物件
          const requestInit: RequestInit & { duplex: 'half' } = {
            method: req.method || 'GET',
            headers: new Headers(req.headers as Record<string, string>),
            duplex: 'half',
            body: req.method !== 'GET' && req.method !== 'HEAD'
              ? req as any
              : undefined,
          }
          const request = new Request(url.toString(), requestInit)

          // 執行處理器
          const response = await handler(request)

          // 回應處理
          res.statusCode = response.status || 200
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })

          const body = await response.text()
          res.end(body)

          console.log(`✅ ${response.status || 200} ${req.method} ${req.url}`)
        } catch (error) {
          console.error(`❌ API 錯誤:`, error)

          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Internal server error',
              message: error instanceof Error ? error.message : String(error)
            })
          )
        }
      })
    }
  }
}
