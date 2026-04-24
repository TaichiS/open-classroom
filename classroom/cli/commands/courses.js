import { apiCall, printJson, printTable } from '../client.js'

export function registerCourses(program) {
  program
    .command('courses')
    .description('列出所有課程')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('courses')
      if (opts.json) { printJson(data); return }
      printTable(data, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '課程名稱' },
        { key: 'course_code', label: '課程碼' },
        { key: 'description', label: '說明' },
      ])
    })
}
