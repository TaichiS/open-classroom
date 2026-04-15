#!/usr/bin/env node

/**
 * API 測試腳本
 * 使用方式：node test-api.js
 */

const API_KEY = process.env.API_KEY || 'your-api-key-here';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.blue);
  console.log('='.repeat(50));
}

// API 測試函數
async function testAPI(name, method, endpoint, data = null) {
  log(`\n🧪 測試: ${name}`, colors.yellow);
  log(`   ${method} ${endpoint}`);

  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const status = response.status;
    const body = await response.json();

    if (status >= 200 && status < 300) {
      log(`   ✅ 成功 (HTTP ${status})`, colors.green);
      log(`   回應:`, colors.blue);
      console.log(JSON.stringify(body, null, 2));
      return { success: true, data: body };
    } else {
      log(`   ❌ 失敗 (HTTP ${status})`, colors.red);
      log(`   錯誤:`, colors.red);
      console.log(JSON.stringify(body, null, 2));
      return { success: false, error: body };
    }
  } catch (error) {
    log(`   ❌ 網路錯誤: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

// 主測試流程
async function main() {
  logSection('API 測試腳本');
  log(`Base URL: ${BASE_URL}`);
  log(`API Key: ${API_KEY.slice(0, 10)}...`);

  // 測試 1: 取得使用者資訊
  const meResult = await testAPI('取得使用者資訊', 'GET', '/api/me');

  if (!meResult.success) {
    log('\n⚠️  認證失敗，請檢查 API Key', colors.red);
    process.exit(1);
  }

  const { id: userId, role } = meResult.data;
  log(`   使用者角色: ${role}`, colors.green);

  // 測試 2: 取得課程列表
  await testAPI('取得課程列表', 'GET', '/api/courses');

  // 角色特定測試
  if (role === 'teacher') {
    logSection('教師專用測試');

    // 這裡需要真實的 courseId
    log('\n⚠️  需要提供真實的 courseId 才能繼續測試', colors.yellow);
    log('   如需完整測試，請修改此腳本並提供:');
    log('   - courseId（課程 ID）');
    log('   - assignmentId（作業 ID）');

    /*
    const courseId = 'your-course-id-here';
    await testAPI('取得作業列表', 'GET', `/api/assignments?courseId=${courseId}`);

    await testAPI('建立作業', 'POST', '/api/assignments', {
      courseId,
      title: '測試作業',
      description: '這是一個 API 測試作業',
      orderIndex: 0,
      submitType: 'complete',
      isActive: true,
    });

    const statsResult = await testAPI('取得統計資訊', 'GET', `/api/stats?courseId=${courseId}`);
    if (statsResult.success) {
      const { totalStudents, totalAssignments, completionRate } = statsResult.data;
      log(`   學生數: ${totalStudents}`, colors.green);
      log(`   作業數: ${totalAssignments}`, colors.green);
      log(`   完成率: ${(completionRate * 100).toFixed(1)}%`, colors.green);
    }
    */
  } else if (role === 'student') {
    logSection('學生專用測試');

    log('\n⚠️  需要提供真實的 courseId 才能繼續測試', colors.yellow);

    /*
    const courseId = 'your-course-id-here';
    await testAPI('取得我的提交', 'GET', `/api/submissions/mine?courseId=${courseId}`);

    await testAPI('取得討論', 'GET', `/api/discussions?assignmentId=xxx`);
    */
  }

  logSection('測試完成');
  log('💡 提示：修改此腳本並填入真實的 ID 可執行完整測試', colors.yellow);
}

main().catch(error => {
  log(`\n❌ 未預期的錯誤: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
