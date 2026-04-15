# API 測試指南

## 系統架構

- **後端**: Supabase (資料庫 + Auth)
- **API 部署**: Vercel Serverless Functions
- **認證方式**: API Key (Bearer Token)

### API Key 格式
- 教師: `cl_teacher_[32字元隨機字串]`
- 學生: `cl_student_[32字元隨機字串]`

## 可用 API 端點

### 1. 使用者資訊
**GET /api/me**
取得當前使用者資訊

**請求範例:**
```bash
curl -X GET http://localhost:5173/api/me \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json"
```

**回應範例:**
```json
{
  "id": "uuid",
  "name": "張老師",
  "role": "teacher",
  "email": "teacher@example.com"
}
```

### 2. 課程管理
**GET /api/courses**
取得課程列表（依角色）

**請求範例:**
```bash
curl -X GET http://localhost:5173/api/courses \
  -H "Authorization: Bearer cl_teacher_xxxxx"
```

**回應範例（教師）:**
```json
[
  {
    "id": "uuid",
    "code": "MED001",
    "name": "醫學導論",
    "teacher_id": "uuid",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### 3. 作業管理

#### 3.1 取得作業列表
**GET /api/assignments?courseId=xxx**

```bash
curl -X GET "http://localhost:5173/api/assignments?courseId=xxx" \
  -H "Authorization: Bearer cl_teacher_xxxxx"
```

#### 3.2 建立作業（教師專用）
**POST /api/assignments**

```bash
curl -X POST http://localhost:5173/api/assignments \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "uuid",
    "title": "作業一",
    "description": "請完成以下任務",
    "orderIndex": 1,
    "submitType": "complete",
    "isActive": true
  }'
```

#### 3.3 批次建立作業
**POST /api/assignments/batch**

```bash
curl -X POST http://localhost:5173/api/assignments/batch \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "uuid",
    "assignments": [
      {
        "title": "作業一",
        "description": "第一個作業",
        "orderIndex": 0
      },
      {
        "title": "作業二",
        "description": "第二個作業",
        "orderIndex": 1
      }
    ]
  }'
```

#### 3.4 更新作業
**PATCH /api/assignments/[id]**

```bash
curl -X PATCH http://localhost:5173/api/assignments/xxx \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新後的標題",
    "isActive": true
  }'
```

### 4. 提交管理

#### 4.1 取得提交記錄（教師）
**GET /api/submissions?assignmentId=xxx**

```bash
curl -X GET "http://localhost:5173/api/submissions?assignmentId=xxx" \
  -H "Authorization: Bearer cl_teacher_xxxxx"
```

#### 4.2 取得我的提交（學生）
**GET /api/submissions/mine?courseId=xxx**

```bash
curl -X GET "http://localhost:5173/api/submissions/mine?courseId=xxx" \
  -H "Authorization: Bearer cl_student_xxxxx"
```

#### 4.3 提交作業（學生）
**POST /api/submissions**

```bash
curl -X POST http://localhost:5173/api/submissions \
  -H "Authorization: Bearer cl_student_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "uuid",
    "submitData": {
      "content": "我的作業內容"
    }
  }'
```

#### 4.4 新增回饋（教師）
**PATCH /api/submissions/[id]/feedback**

```bash
curl -X PATCH http://localhost:5173/api/submissions/xxx/feedback \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "feedback": "做得很好！"
  }'
```

#### 4.5 批次回饋
**POST /api/submissions/batch-feedback**

```bash
curl -X POST http://localhost:5173/api/submissions/batch-feedback \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbacks": [
      { "submissionId": "uuid1", "feedback": "做得好" },
      { "submissionId": "uuid2", "feedback": "需要改進" }
    ]
  }'
```

### 5. 討論管理

#### 5.1 取得討論
**GET /api/discussions?assignmentId=xxx**

```bash
curl -X GET "http://localhost:5173/api/discussions?assignmentId=xxx" \
  -H "Authorization: Bearer cl_student_xxxxx"
```

#### 5.2 新增討論
**POST /api/discussions**

```bash
curl -X POST http://localhost:5173/api/discussions \
  -H "Authorization: Bearer cl_student_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "uuid",
    "courseId": "uuid",
    "content": "這個作業怎麼做？"
  }'
```

#### 5.3 回覆討論
**POST /api/discussions**（包含 parentId）

```bash
curl -X POST http://localhost:5173/api/discussions \
  -H "Authorization: Bearer cl_teacher_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "uuid",
    "courseId": "uuid",
    "content": "請看課程教材第三章",
    "parentId": "parent-uuid"
  }'
```

### 6. 統計資訊（教師專用）
**GET /api/stats?courseId=xxx**

```bash
curl -X GET "http://localhost:5173/api/stats?courseId=xxx" \
  -H "Authorization: Bearer cl_teacher_xxxxx"
```

**回應範例:**
```json
{
  "totalStudents": 30,
  "totalAssignments": 5,
  "submissionsByAssignment": [
    {
      "assignmentId": "uuid",
      "title": "作業一",
      "submitted": 25,
      "pending": 5
    }
  ],
  "completionRate": 0.83
}
```

### 7. API Key 管理

#### 7.1 建立 API Key
**POST /api/keys**
需要使用 Supabase session JWT（非 API Key）

```bash
curl -X POST http://localhost:5173/api/keys \
  -H "Authorization: Bearer <SUPABASE_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "CLI 測試"
  }'
```

**回應範例（重要：key 只回傳一次）：**
```json
{
  "id": "uuid",
  "label": "CLI 測試",
  "role": "teacher",
  "created_at": "2024-01-01T00:00:00Z",
  "key": "cl_teacher_AbCdEf123456789..."
}
```

#### 7.2 刪除 API Key
**DELETE /api/keys/[id]**
需要使用 Supabase session JWT

```bash
curl -X DELETE http://localhost:5173/api/keys/uuid \
  -H "Authorization: Bearer <SUPABASE_JWT_TOKEN>"
```

## 錯誤回應格式

所有錯誤回應都遵循統一格式：

```json
{
  "error": "錯誤訊息"
}
```

常見 HTTP 狀態碼：
- `400` Bad Request - 請求參數錯誤
- `401` Unauthorized - 認證失敗
- `403` Forbidden - 權限不足
- `404` Not Found - 資源不存在
- `405` Method Not Allowed - HTTP 方法不支援
- `500` Internal Server Error - 伺服器錯誤

## 快速測試流程

1. **啟動開發伺服器:**
   ```bash
   cd classroom
   npm run dev
   ```

2. **取得 API Key**（需要透過前端登入後使用 Supabase JWT）
   - 這需要在瀏覽器中登入後取得

3. **測試 API**（使用上面的範例）

## 生產環境部署

API 已配置為部署到 Vercel，環境變數：
- `SUPABASE_URL` - Supabase 專案 URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key（保密）

部署後 API 路徑：`https://your-project.vercel.app/api/*`
