import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const API_DIR = path.dirname(fileURLToPath(import.meta.url))

// 路由表定義
export const routes: Record<string, string> = {
  // 基礎端點
  '/me': './me.ts',
  '/courses': './courses.ts',
  '/stats': './stats.ts',
  '/discussions': './discussions.ts',

  // 作業相關
  '/assignments': './assignments/index.ts',
  '/assignments/batch': './assignments/batch.ts',

  // 提交相關
  '/submissions': './submissions/[[...slug]].ts',

  // API Key 管理
  '/keys': './keys/index.ts',
}

// 動態路徑模式
const dynamicPatterns: Array<{ pattern: RegExp; handler: string }> = [
  // /api/assignments/[id]
  { pattern: /^\/assignments\/[^/]+$/, handler: './assignments/[id].ts' },
  // /api/keys/[id]
  { pattern: /^\/keys\/[^/]+$/, handler: './keys/[id].ts' },
  // /api/submissions/[id]/feedback
  { pattern: /^\/submissions\/[^/]+\/feedback$/, handler: './submissions/[[...slug]].ts' },
]

// 動態載入 API 處理器
const handlerCache: Record<string, any> = {}

async function loadHandler(handlerPath: string) {
  if (handlerCache[handlerPath]) {
    return handlerCache[handlerPath]
  }

  const fullPath = path.join(API_DIR, handlerPath.slice(2)) // 移除 './'

  console.log(`📁 嘗試載入: ${fullPath}`)

  // 直接使用相對路徑載入
  const module = await import(fullPath)

  console.log(`📦 模組匯出:`, Object.keys(module).slice(0, 5))

  if (!module.default) {
    console.log(`❌ 模組沒有預設匯出`)
    throw new Error(`Module ${handlerPath} has no default export`)
  }

  handlerCache[handlerPath] = module.default
  return module.default
}

// 根據路徑尋找處理器
export async function findHandler(pathname: string): Promise<Function | null> {
  // 移除開頭的斜槓
  const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname

  console.log(`🔍 尋找處理器: "${pathname}" -> "${normalizedPath}"`)
  console.log(`🔑 路由表:`, JSON.stringify(routes, null, 2))

  // 檢查精確匹配（包含前導斜槓）
  const pathWithSlash = pathname.startsWith('/') ? pathname : `/${pathname}`

  console.log(`🔑 檢查: "${pathWithSlash}" 在 routes 中?`, pathWithSlash in routes)

  if (routes[pathWithSlash]) {
    console.log(`✅ 路由匹配: ${pathWithSlash} -> ${routes[pathWithSlash]}`)
    return loadHandler(routes[pathWithSlash])
  }

  // 檢查動態路徑模式
  for (const { pattern, handler } of dynamicPatterns) {
    if (pattern.test(normalizedPath)) {
      console.log(`✅ 動態路由匹配: ${normalizedPath} -> ${handler}`)
      return loadHandler(handler)
    }
  }

  // 檢查是否有目錄下的 index.ts
  const possibleIndexPath = path.join(API_DIR, normalizedPath, 'index.ts')
  if (fs.existsSync(possibleIndexPath)) {
    console.log(`✅ 目錄匹配: ${normalizedPath} -> ./${normalizedPath}/index.ts`)
    return loadHandler(`./${normalizedPath}/index.ts`)
  }

  console.log(`❌ 找不到處理器: ${normalizedPath}`)
  return null
}

// 預載入常用處理器
export async function warmupCache() {
  console.log('🔥 預熱 API 處理器快取...')

  for (const handlerPath of Object.values(routes)) {
    try {
      await loadHandler(handlerPath)
      console.log(`✅ 載入: ${handlerPath}`)
    } catch (error) {
      console.error(`❌ 載入失敗: ${handlerPath}`, error)
    }
  }
}
