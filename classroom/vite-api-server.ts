import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 載入 API 索引
let apiIndex: any = null
let warmupComplete = false

export default function apiMiddleware() {
  return {
    name: 'api-middleware',
    async configureServer(server) {
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
            const indexPath = path.join(__dirname, 'api', 'index.ts')
            const indexModule = await import(indexPath)
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
          const request = new Request(url.toString(), {
            method: req.method || 'GET',
            headers: new Headers(req.headers as Record<string, string>),
            body: req.method !== 'GET' && req.method !== 'HEAD'
              ? req as any
              : undefined,
          })

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
