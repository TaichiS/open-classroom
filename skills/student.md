---
name: classroom-student
description: Open Classroom 學生操作 skill，可查看作業、繳交、查看討論區
triggers:
  - classroom
  - 我的作業
---

# Open Classroom 學生 Skill

## Setup

首次使用前，檢查 `~/.classroom/config.json` 是否存在。若不存在，執行 setup 精靈：

1. 詢問：「請輸入你的 Open Classroom 部署網址（例如 https://my-classroom.vercel.app）：」
2. 告知：「請到 {網址}/student → Dashboard 右上角 → API Keys → 產生新 Key，複製後貼回來。」
3. 詢問：「請貼上你的 API Key（格式：cl_student_...）：」
4. 寫入 `~/.classroom/config.json`：
   ```json
   { "apiUrl": "使用者輸入的網址", "apiKey": "使用者貼上的 key" }
   ```
5. 呼叫 `GET {apiUrl}/api/me`，帶 `Authorization: Bearer {apiKey}`，顯示「歡迎，{name}！設定完成。」

## 讀取設定

每次操作前讀取 `~/.classroom/config.json`，取得 `apiUrl` 和 `apiKey`。

## 操作對應

### 查看我的課程
呼叫 `GET {apiUrl}/api/courses`，列出已加入的課程。

### 查看作業
1. 若未指定課程，先列出課程讓使用者選擇
2. 呼叫 `GET {apiUrl}/api/assignments?courseId={id}`（只回傳已釋出的）
3. 顯示作業清單，標注已繳交/未繳交

### 查看我的繳交狀態
1. 選擇課程
2. 呼叫 `GET {apiUrl}/api/submissions/mine?courseId={id}`
3. 顯示：
   ```
   ✅ Day 1 — 已繳交（2026-04-10 14:32）
   ⏳ Day 2 — 未繳交
   🔒 Day 3 — 尚未開放
   ```

### 繳交作業
1. 確認課程 + 作業
2. 詢問：「請輸入繳交內容（連結 / 說明 / 打完成）：」
3. 呼叫 `POST {apiUrl}/api/submissions`，body：
   ```json
   { "assignmentId": "...", "submitData": "使用者輸入的內容" }
   ```
4. 顯示「繳交成功！」

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
curl -o ~/.claude/plugins/classroom-student.md \
  https://raw.githubusercontent.com/TaichiS/open-classroom/main/skills/student.md
```
