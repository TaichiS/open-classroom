import { readFileSync } from 'fs'
import { apiCall, printJson, printTable } from '../client.js'

export function registerSubmissions(program) {
  const cmd = program.command('submissions').description('提交管理')

  // 教師：列出作業的所有提交
  cmd
    .command('list')
    .alias('ls')
    .description('列出作業的所有提交（教師）')
    .requiredOption('-a, --assignment <assignmentId>', '作業 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('submissions', { params: { assignmentId: opts.assignment } })
      if (opts.json) { printJson(data); return }
      printTable(data, [
        { key: 'id', label: 'ID' },
        { key: 'studentName', label: '學生' },
        { key: 'status', label: '狀態' },
        { key: 'submitted_at', label: '提交時間' },
        { key: 'feedback', label: '評語' },
      ])
    })

  // 學生：查看自己的提交狀態
  cmd
    .command('mine')
    .description('查看自己在課程中的提交狀態（學生）')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('submissions/mine', { params: { courseId: opts.course } })
      if (opts.json) { printJson(data); return }
      const rows = data.map(item => ({
        title: item.assignment.title,
        status: item.submission?.status ?? '未提交',
        submitted_at: item.submission?.submitted_at ?? '',
        feedback: item.submission?.feedback ?? '',
      }))
      printTable(rows, [
        { key: 'title', label: '作業' },
        { key: 'status', label: '狀態' },
        { key: 'submitted_at', label: '提交時間' },
        { key: 'feedback', label: '評語' },
      ])
    })

  // 學生：提交作業
  cmd
    .command('submit')
    .description('提交作業（學生）')
    .requiredOption('-a, --assignment <assignmentId>', '作業 ID')
    .option('--data <text>', '提交內容')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('submissions', {
        method: 'POST',
        body: { assignmentId: opts.assignment, submitData: opts.data ?? null },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 提交成功：狀態 = ${data.status}`)
    })

  // 教師：新增單筆評語
  cmd
    .command('feedback <submissionId>')
    .description('新增或更新提交評語（教師）')
    .requiredOption('--text <feedback>', '評語內容')
    .option('--json', '輸出原始 JSON')
    .action(async (submissionId, opts) => {
      const data = await apiCall(`submissions/${submissionId}/feedback`, {
        method: 'PATCH',
        body: { feedback: opts.text },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 評語已更新`)
    })

  // 教師：批次評語
  cmd
    .command('batch-feedback')
    .description('批次更新評語（教師），從 JSON 檔案讀取')
    .requiredOption('-f, --file <path>', 'JSON 檔案路徑（feedbacks 陣列）')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      let feedbacks
      try {
        feedbacks = JSON.parse(readFileSync(opts.file, 'utf8'))
        if (!Array.isArray(feedbacks)) throw new Error()
      } catch {
        console.error('檔案格式錯誤：需為 JSON 陣列，每項含 submissionId 和 feedback')
        process.exit(1)
      }
      const data = await apiCall('submissions/batch-feedback', {
        method: 'POST',
        body: { feedbacks },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 成功更新 ${data.updated} 筆評語`)
    })
}
