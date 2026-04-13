---
name: classroom-teacher
description: Open Classroom 教師操作 skill，可批次建立作業、批改、查看統計、討論區
triggers:
  - classroom
  - 作業管理
---

# Open Classroom 教師 Skill

## Setup

首次使用前，檢查 `~/.classroom/config.json` 是否存在。若不存在，執行 setup 精靈：

1. 詢問：「請輸入你的 Open Classroom 部署網址（例如 https://my-classroom.vercel.app）：」
2. 告知：「請到 {網址}/teacher → Dashboard 右上角 → API Keys → 產生新 Key，複製後貼回來。」
3. 詢問：「請貼上你的 API Key（格式：cl_teacher_...）：」
4. 寫入 `~/.classroom/config.json`：
   ```json
   { "apiUrl": "使用者輸入的網址", "apiKey": "使用者貼上的 key" }
   ```
5. 呼叫 `GET {apiUrl}/api/me`，帶 `Authorization: Bearer {apiKey}`，顯示「歡迎，{name}！設定完成。」

## 讀取設定

每次操作前讀取 `~/.classroom/config.json`，取得 `apiUrl` 和 `apiKey`。

## 操作對應

### 查看課程
呼叫 `GET {apiUrl}/api/courses`，列出課程 id 和名稱。

### 查看作業
1. 若未指定課程，先列出課程讓使用者選擇
2. 呼叫 `GET {apiUrl}/api/assignments?courseId={id}`
3. 顯示作業清單（含 isActive 狀態）

### 建立作業
1. 詢問：課程、標題、說明、繳交方式（complete/file/link/image）、是否立即釋出
2. 呼叫 `POST {apiUrl}/api/assignments`，body：
   ```json
   { "courseId": "...", "title": "...", "description": "...", "submitType": "complete", "isActive": false }
   ```

### 批次建立作業
1. 詢問：「請描述要建立的作業，或提供 JSON 陣列（含 title, description）」
2. 解析輸入，呼叫 `POST {apiUrl}/api/assignments/batch`，body：
   ```json
   { "courseId": "...", "assignments": [{ "title": "...", "description": "..." }] }
   ```
3. 顯示：「已建立 {n} 個作業，{m} 個失敗。」

### 釋出作業
呼叫 `PATCH {apiUrl}/api/assignments/{id}`，body：`{ "isActive": true }`

### 查看繳交
1. 確認課程 + 作業
2. 呼叫 `GET {apiUrl}/api/submissions?assignmentId={id}`
3. 以表格顯示學生名稱、繳交時間、評語狀態

### 批次 AI 批改
```
1. 列出課程作業，讓教師選擇
2. GET {apiUrl}/api/submissions?assignmentId={id} 取得所有繳交
3. 顯示作業說明作為評分依據
4. 逐一對每份 submitData，Claude 產生繁體中文、鼓勵式評語草稿
5. 顯示「[學生名] 的評語草稿：{內容}」
   詢問「確認(Enter) / 修改(m) / 跳過(s)」
6. 收集確認的評語，POST {apiUrl}/api/submissions/batch-feedback，body：
   { "feedbacks": [{ "submissionId": "...", "feedback": "..." }] }
7. 顯示「已給 {n} 份評語。」
```

### 課程統計
呼叫 `GET {apiUrl}/api/stats?courseId={id}`，以表格顯示每個作業的繳交率。

### 查看討論區
1. 呼叫 `GET {apiUrl}/api/discussions?assignmentId={id}`
2. 以縮排顯示巢狀結構：
   ```
   📌 [王老師] 2026-04-12 14:30
      這份作業請把 Claude Code 的截圖附上來

      ↳ [張同學] 14:35
        好的老師！
   ```

### 在討論區發文或回覆
1. 若是回覆，先列出現有討論（含編號），讓使用者選「回覆第 N 則」
2. 詢問發文內容
3. 呼叫 `POST {apiUrl}/api/discussions`，body：
   ```json
   { "assignmentId": "...", "courseId": "...", "content": "...", "parentId": "（可選）" }
   ```

## 安裝

```bash
curl -o ~/.claude/plugins/classroom-teacher.md \
  https://raw.githubusercontent.com/TaichiS/open-classroom/main/skills/teacher.md
```
