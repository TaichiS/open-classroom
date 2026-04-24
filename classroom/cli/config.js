import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_PATH = join(homedir(), '.classroom-cli.json')

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export function saveConfig(updates) {
  const current = loadConfig()
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...updates }, null, 2))
}

export function requireConfig() {
  const cfg = loadConfig()
  if (!cfg.apiKey) {
    console.error('錯誤：尚未設定 API Key。請先執行：classroom config --key <API_KEY>')
    process.exit(1)
  }
  if (!cfg.baseUrl) {
    console.error('錯誤：尚未設定 Base URL。請先執行：classroom config --url <BASE_URL>')
    process.exit(1)
  }
  return cfg
}
