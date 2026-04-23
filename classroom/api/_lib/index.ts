import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.dirname(__dirname)

// 匯出共用函數
export { verifyApiKey, verifySessionJwt, jsonResponse, errorResponse, withErrorHandler } from './auth.js'
export { supabase } from './supabase.js'

// 重新匯出型別
export type { AuthResult } from './auth.js'

// 提供路徑匯出
export const PATHS = {
  auth: path.join(__dirname, 'auth.js'),
  supabase: path.join(__dirname, 'supabase.js')
}