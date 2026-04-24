#!/usr/bin/env node
import { program } from 'commander'
import { loadConfig, saveConfig } from './config.js'
import { registerMe } from './commands/me.js'
import { registerCourses } from './commands/courses.js'
import { registerAssignments } from './commands/assignments.js'
import { registerSubmissions } from './commands/submissions.js'
import { registerStats } from './commands/stats.js'
import { registerDiscussions } from './commands/discussions.js'

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
  .action((action, opts) => {
    if (action === 'show') {
      const cfg = loadConfig()
      if (!cfg.apiKey && !cfg.baseUrl) {
        console.log('（尚未設定）')
      } else {
        console.log(`API Key: ${cfg.apiKey ? cfg.apiKey.slice(0, 15) + '…' : '未設定'}`)
        console.log(`Base URL: ${cfg.baseUrl ?? '未設定'}`)
      }
      return
    }
    if (!opts.key && !opts.url) {
      console.error('請提供 --key 或 --url 選項')
      process.exit(1)
    }
    const updates = {}
    if (opts.key) updates.apiKey = opts.key
    if (opts.url) updates.baseUrl = opts.url
    if (!loadConfig().baseUrl && !opts.url) {
      updates.baseUrl = 'https://classroom-wheat-rho.vercel.app'
    }
    saveConfig(updates)
    console.log('✅ 設定已儲存')
    if (updates.apiKey) console.log(`  API Key: ${updates.apiKey.slice(0, 15)}…`)
    if (updates.baseUrl) console.log(`  Base URL: ${updates.baseUrl}`)
  })

registerMe(program)
registerCourses(program)
registerAssignments(program)
registerSubmissions(program)
registerStats(program)
registerDiscussions(program)

program.parseAsync()
