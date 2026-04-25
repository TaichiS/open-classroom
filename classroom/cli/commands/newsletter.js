import { readFileSync, existsSync } from 'fs'
import { loadConfig, requireConfig } from '../config.js'

async function resendSend({ apiKey, from, to, bcc, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, bcc, subject, html }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.message ?? JSON.stringify(data))
  }
  return data
}

function loadHtml(filePath) {
  if (!existsSync(filePath)) {
    console.error(`找不到檔案：${filePath}`)
    process.exit(1)
  }
  return readFileSync(filePath, 'utf8')
}

function parseRecipients(toOpt, fileOpt) {
  const emails = []
  if (toOpt) {
    emails.push(...toOpt.split(',').map(e => e.trim()).filter(Boolean))
  }
  if (fileOpt) {
    if (!existsSync(fileOpt)) {
      console.error(`找不到收件人檔案：${fileOpt}`)
      process.exit(1)
    }
    const lines = readFileSync(fileOpt, 'utf8').split('\n')
    emails.push(...lines.map(l => l.trim()).filter(l => l && l.includes('@')))
  }
  return [...new Set(emails)]
}

function requireResendConfig(cfg) {
  if (!cfg.resendApiKey) {
    console.error('錯誤：尚未設定 Resend API Key。請執行：classroom config --resend-key <KEY>')
    process.exit(1)
  }
  if (!cfg.fromEmail) {
    console.error('錯誤：尚未設定寄件人 Email。請執行：classroom config --from-email <EMAIL>')
    process.exit(1)
  }
  if (!cfg.selfEmail) {
    console.error('錯誤：尚未設定自己的 Email。請執行：classroom config --self-email <EMAIL>')
    process.exit(1)
  }
}

export function registerNewsletter(program) {
  const cmd = program.command('newsletter').description('電子報寄送（需設定 Resend API Key）')

  // 寄送給收件人清單
  cmd
    .command('send')
    .description('寄送電子報給收件人')
    .requiredOption('--subject <text>', '郵件主旨')
    .requiredOption('--html-file <path>', 'HTML 郵件內容檔案')
    .option('--to <emails>', '收件人 Email（逗號分隔）')
    .option('--recipients-file <path>', '收件人清單檔案（每行一個 Email）')
    .action(async (opts) => {
      requireConfig()
      const cfg = loadConfig()
      requireResendConfig(cfg)

      const recipients = parseRecipients(opts.to, opts.recipientsFile)
      if (!recipients.length) {
        console.error('錯誤：請提供 --to 或 --recipients-file')
        process.exit(1)
      }

      const html = loadHtml(opts.htmlFile)

      console.log(`📧 準備寄送給 ${recipients.length} 位收件人...`)
      console.log(`   主旨：${opts.subject}`)
      console.log(`   寄件人：${cfg.fromEmail}`)
      console.log(`   BCC：${recipients.slice(0, 3).join(', ')}${recipients.length > 3 ? ` 等 ${recipients.length} 人` : ''}`)

      try {
        const result = await resendSend({
          apiKey: cfg.resendApiKey,
          from: cfg.fromEmail,
          to: cfg.selfEmail,   // to 填自己（BCC 保護隱私）
          bcc: recipients,
          subject: opts.subject,
          html,
        })
        console.log(`✅ 寄送成功！郵件 ID：${result.id}`)
      } catch (err) {
        console.error(`❌ 寄送失敗：${err.message}`)
        process.exit(1)
      }
    })

  // 測試：寄給自己
  cmd
    .command('test')
    .description('測試寄送（只寄給自己，主旨加 [TEST] 前綴）')
    .requiredOption('--subject <text>', '郵件主旨')
    .requiredOption('--html-file <path>', 'HTML 郵件內容檔案')
    .option('--to <email>', '覆蓋收件地址（預設使用 self-email 設定）')
    .action(async (opts) => {
      requireConfig()
      const cfg = loadConfig()
      requireResendConfig(cfg)

      const html = loadHtml(opts.htmlFile)
      const recipient = opts.to ?? cfg.selfEmail
      const subject = `[TEST] ${opts.subject}`

      console.log(`🧪 測試寄送中...`)
      console.log(`   主旨：${subject}`)
      console.log(`   收件人：${recipient}`)

      try {
        const result = await resendSend({
          apiKey: cfg.resendApiKey,
          from: cfg.fromEmail,
          to: recipient,
          subject,
          html,
        })
        console.log(`✅ 測試郵件已寄出！郵件 ID：${result.id}`)
        console.log(`   請至 ${recipient} 收件匣確認排版`)
      } catch (err) {
        console.error(`❌ 寄送失敗：${err.message}`)
        process.exit(1)
      }
    })
}
