import { apiCall, printJson } from '../client.js'

export function registerDiscussions(program) {
  const cmd = program.command('discussions').description('討論區管理')

  cmd
    .command('list')
    .alias('ls')
    .description('列出作業討論')
    .requiredOption('-a, --assignment <assignmentId>', '作業 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('discussions', { params: { assignmentId: opts.assignment } })
      if (opts.json) { printJson(data); return }
      if (!data.length) { console.log('（無討論）'); return }
      data.forEach(msg => {
        const time = new Date(msg.created_at).toLocaleString('zh-TW')
        console.log(`[${msg.user_role}] ${msg.user_name}  ${time}`)
        console.log(`  ${msg.content}`)
        if (msg.replies?.length) {
          msg.replies.forEach(r => {
            const rt = new Date(r.created_at).toLocaleString('zh-TW')
            console.log(`  └─ [${r.user_role}] ${r.user_name}  ${rt}`)
            console.log(`     ${r.content}`)
          })
        }
        console.log('')
      })
    })

  cmd
    .command('post')
    .description('發布討論訊息')
    .requiredOption('-a, --assignment <assignmentId>', '作業 ID')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .requiredOption('--content <text>', '訊息內容')
    .option('--reply-to <parentId>', '回覆指定訊息 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('discussions', {
        method: 'POST',
        body: {
          assignmentId: opts.assignment,
          courseId: opts.course,
          content: opts.content,
          parentId: opts.replyTo ?? null,
        },
      })
      if (opts.json) { printJson(data); return }
      console.log(`✅ 訊息已發布`)
    })
}
