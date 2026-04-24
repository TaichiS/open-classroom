import { apiCall, printJson } from '../client.js'

export function registerStats(program) {
  program
    .command('stats')
    .description('課程提交統計（教師）')
    .requiredOption('-c, --course <courseId>', '課程 ID')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('stats', { params: { courseId: opts.course } })
      if (opts.json) { printJson(data); return }

      const rate = (data.completionRate * 100).toFixed(1)
      console.log(`學生人數：${data.totalStudents}`)
      console.log(`作業數量：${data.totalAssignments}`)
      console.log(`整體完成率：${rate}%`)
      console.log('')
      console.log('各作業提交狀況：')
      data.submissionsByAssignment.forEach(a => {
        const bar = '█'.repeat(Math.round((a.submitted / data.totalStudents) * 20))
        const empty = '░'.repeat(20 - bar.length)
        console.log(`  ${a.title}`)
        console.log(`  [${bar}${empty}] 已交 ${a.submitted}／待交 ${a.pending}`)
      })
    })
}
