import { requireConfig } from './config.js'

export async function apiCall(path, { method = 'GET', body, params } = {}) {
  const { apiKey, baseUrl } = requireConfig()

  let url = `${baseUrl.replace(/\/$/, '')}/api/${path.replace(/^\//, '')}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`API 回傳非 JSON：${text}`)
    process.exit(1)
  }

  if (!res.ok) {
    console.error(`API 錯誤 [${res.status}]：${data?.error ?? text}`)
    process.exit(1)
  }

  return data
}

// 輸出工具
export function printJson(data) {
  console.log(JSON.stringify(data, null, 2))
}

export function printTable(rows, columns) {
  if (!rows.length) { console.log('（無資料）'); return }
  const widths = columns.map(c =>
    Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? '').length))
  )
  const header = columns.map((c, i) => c.label.padEnd(widths[i])).join('  ')
  const divider = widths.map(w => '-'.repeat(w)).join('  ')
  console.log(header)
  console.log(divider)
  rows.forEach(r => {
    console.log(columns.map((c, i) => String(r[c.key] ?? '').padEnd(widths[i])).join('  '))
  })
}
