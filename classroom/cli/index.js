#!/usr/bin/env node
import { program } from 'commander'
import { loadConfig, saveConfig } from './config.js'
import { registerMe } from './commands/me.js'
import { registerCourses } from './commands/courses.js'
import { registerAssignments } from './commands/assignments.js'
import { registerSubmissions } from './commands/submissions.js'
import { registerStats } from './commands/stats.js'
import { registerDiscussions } from './commands/discussions.js'
import { registerNewsletter } from './commands/newsletter.js'

program
  .name('classroom')
  .description('作業管理系統 CLI 工具')
  .version('1.0.0')

// classroom config --key <key> [--url <url>]
// classroom config show
program
  .command('config [action]')
  .description('設定 API Key 與 Base URL')
  .option('--key <apiKey>', 'API Key（格式：cl_teacher_xxx 或 cl_student_xxx）')
  .option('--url <baseUrl>', 'Base URL（預設：https://classroom-wheat-rho.vercel.app）')
  .option('--resend-key <resendApiKey>', 'Resend API Key（用於 newsletter 寄送）')
  .option('--from-email <email>', '寄件人 Email（需已在 Resend 驗證網域）')
  .option('--self-email <email>', '自己的 Email（newsletter test 寄送目標）')
  .action((action, opts) => {
    if (action === 'show') {
      const cfg = loadConfig()
      if (!cfg.apiKey && !cfg.baseUrl && !cfg.resendApiKey && !cfg.fromEmail && !cfg.selfEmail) {
        console.log('（尚未設定）')
      } else {
        console.log(`API Key:        ${cfg.apiKey ? cfg.apiKey.slice(0, 15) + '…' : '未設定'}`)
        console.log(`Base URL:       ${cfg.baseUrl ?? '未設定'}`)
        console.log(`Resend API Key: ${cfg.resendApiKey ? cfg.resendApiKey.slice(0, 10) + '…' : '未設定'}`)
        console.log(`From Email:     ${cfg.fromEmail ?? '未設定'}`)
        console.log(`Self Email:     ${cfg.selfEmail ?? '未設定'}`)
      }
      return
    }
    if (!opts.key && !opts.url && !opts.resendKey && !opts.fromEmail && !opts.selfEmail) {
      console.error('請提供 --key、--url、--resend-key、--from-email 或 --self-email 選項')
      process.exit(1)
    }
    const updates = {}
    if (opts.key) updates.apiKey = opts.key
    if (opts.url) updates.baseUrl = opts.url
    if (opts.resendKey) updates.resendApiKey = opts.resendKey
    if (opts.fromEmail) updates.fromEmail = opts.fromEmail
    if (opts.selfEmail) updates.selfEmail = opts.selfEmail
    if (!loadConfig().baseUrl && !opts.url) {
      updates.baseUrl = 'https://classroom-wheat-rho.vercel.app'
    }
    saveConfig(updates)
    console.log('✅ 設定已儲存')
    if (updates.apiKey) console.log(`  API Key: ${updates.apiKey.slice(0, 15)}…`)
    if (updates.baseUrl) console.log(`  Base URL: ${updates.baseUrl}`)
    if (updates.resendApiKey) console.log(`  Resend API Key: ${updates.resendApiKey.slice(0, 10)}…`)
    if (updates.fromEmail) console.log(`  From Email: ${updates.fromEmail}`)
    if (updates.selfEmail) console.log(`  Self Email: ${updates.selfEmail}`)
  })

registerMe(program)
registerCourses(program)
registerAssignments(program)
registerSubmissions(program)
registerStats(program)
registerDiscussions(program)
registerNewsletter(program)

program.parseAsync()
