import { readFileSync } from 'fs'
import { apiCall, printJson, printTable } from '../client.js'

export function registerAssignments(program) {
  const cmd = program.command('assignments').description('作業管理')

  // 列出作業
  cmd
    .command('list')
    .alias('ls')
    .description('列出課程作業')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('assignments', { params: { courseId: opts.course } })
      if (opts.json) { printJson(data); return }
      printTable(data, [
        { key: 'id', label: 'ID' },
        { key: 'order_index', label: '#' },
        { key: 'title', label: '標題' },
        { key: 'submit_type', label: '類型' },
        { key: 'is_active', label: '已發布' },
        { key: 'due_date', label: '截止日' },
      ])
    })

  // 建立作業
  cmd
    .command('create')
    .description('建立新作業（教師）')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .requiredOption('-t, --title <title>', '作業標題')
    .requiredOption('-d, --desc <description>', '作業說明')
    .option('--type <submitType>', '提交類型 complete|file|link|image', 'complete')
    .option('--active', '立即發布', false)
    .option('--due <date>', '截止日期（ISO 8601）')
    .option('--order <n>', '排序索引', '0')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('assignments', {
        method: 'POST',
        body: {
          courseId: opts.course,
          title: opts.title,
          description: opts.desc,
          submitType: opts.type,
          isActive: opts.active,
          dueDate: opts.due ?? null,
          orderIndex: parseInt(opts.order),
        },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 作業已建立：[${data.id}] ${data.title}`)
    })

  // 更新作業
  cmd
    .command('update <id>')
    .description('更新作業（教師）')
    .option('-t, --title <title>', '新標題')
    .option('-d, --desc <description>', '新說明')
    .option('--active', '設為已發布')
    .option('--inactive', '設為未發布')
    .option('--due <date>', '截止日期（ISO 8601）')
    .option('--json', '輸出原始 JSON')
    .action(async (id, opts) => {
      const body = {}
      if (opts.title) body.title = opts.title
      if (opts.desc) body.description = opts.desc
      if (opts.active) body.isActive = true
      if (opts.inactive) body.isActive = false
      if (opts.due) body.dueDate = opts.due
      if (!Object.keys(body).length) {
        console.error('請至少提供一個更新欄位')
        process.exit(1)
      }
      const data = await apiCall(`assignments/${id}`, { method: 'PATCH', body })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 作業已更新：[${data.id}] ${data.title}`)
    })

  // 批次建立
  cmd
    .command('batch')
    .description('批次建立作業（教師），從 JSON 檔案讀取')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .requiredOption('-f, --file <path>', 'JSON 檔案路徑（assignments 陣列）')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      let assignments
      try {
        assignments = JSON.parse(readFileSync(opts.file, 'utf8'))
        if (!Array.isArray(assignments)) throw new Error()
      } catch {
        console.error('檔案格式錯誤：需為 JSON 陣列')
        process.exit(1)
      }
      const data = await apiCall('assignments/batch', {
        method: 'POST',
        body: { courseId: opts.course, assignments },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 成功建立 ${data.created.length} 筆，失敗 ${data.errors.length} 筆`)
      if (data.errors.length) {
        data.errors.forEach(e => console.error(`  第 ${e.index} 筆失敗：${e.message}`))
      }
    })
}
