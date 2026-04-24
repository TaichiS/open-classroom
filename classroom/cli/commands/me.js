import { apiCall, printJson, printTable } from '../client.js'

export function registerMe(program) {
  program
    .command('me')
    .description('取得當前用戶資訊')
    .option('--json', '輸出原始 JSON')
    .action(async (opts) => {
      const data = await apiCall('me')
      if (opts.json) { printJson(data); return }
      printTable([data], [
        { key: 'name', label: '姓名' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: '角色' },
        { key: 'id', label: 'ID' },
      ])
    })
}
