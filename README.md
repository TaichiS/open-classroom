# Open Classroom 🎓

> 致敬 Google Classroom 的開源作業管理系統
> 適合老師自架，完全免費，無需後端工程師

**[線上 Demo →](https://vue-app-gray-eight.vercel.app)**

---

## 功能特色

- **Google 一鍵登入** — 學生老師都用 Google 帳號，免註冊
- **逐步釋出作業** — 老師控制作業開放順序，學生按步完成
- **Email 通知** — 作業釋出時自動寄信給學生
- **即時討論區** — 每份作業都有討論串，即時更新
- **展示中心** — 學生優秀作業老師可核准公開展示
- **一鍵繳交** — 支援連結、檔案、圖片、完成打卡

---

## 部署費用

| 服務 | 用途 | 費用 |
|------|------|------|
| [Vercel](https://vercel.com) | 網站託管 | 免費 |
| [Supabase](https://supabase.com) | 資料庫 + 登入 | 免費（每月 500MB）|
| [Resend](https://resend.com) | Email 通知 | 免費（每月 3,000 封）|
| Google OAuth | Google 登入 | 免費 |

---

## 部署教學（約 30 分鐘）

### 第一步：建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) → 點「Start your project」
2. 用 GitHub 帳號登入（沒有的話先申請）
3. 點「New project」，填入：
   - **Name**：任意名稱，例如 `my-classroom`
   - **Database Password**：設一個密碼（記下來備用）
   - **Region**：選 `Northeast Asia (Tokyo)`（台灣最近）
4. 等待約 1 分鐘建立完成

### 第二步：建立資料表

1. 在 Supabase 專案頁面，點左側「**SQL Editor**」
2. 點「**New query**」
3. 複製 `supabase/migrations/001_schema.sql` 的全部內容，貼入編輯框
4. 點「**Run**」（右下角）
5. 看到 `Success` 表示完成

### 第三步：設定 Google 登入

**先到 Google Cloud Console 申請 OAuth：**

1. 前往 [console.cloud.google.com](https://console.cloud.google.com)
2. 左上角點「選取專案」→「新增專案」，名稱隨意
3. 左側選單 → 「**API 和服務**」→「**OAuth 同意畫面**」
   - User Type 選「外部」→ 建立
   - 填入應用程式名稱（例如「我的教室」）、支援電子郵件
   - 按「儲存並繼續」直到完成
4. 左側選單 → 「**憑證**」→「**建立憑證**」→「**OAuth 用戶端 ID**」
   - 應用程式類型：**網頁應用程式**
   - 名稱：任意
   - **已授權的重新導向 URI**，點「新增 URI」填入：
     ```
     https://你的ProjectID.supabase.co/auth/v1/callback
     ```
     （在 Supabase → Project Settings → General 可找到 Project ID）
   - 點「建立」，記下「**用戶端 ID**」與「**用戶端密鑰**」

**回到 Supabase 設定 Google：**

1. Supabase 左側 → 「**Authentication**」→「**Providers**」
2. 找到「**Google**」，點開啟用
3. 填入剛才的 Client ID 和 Client Secret
4. 點「Save」

### 第四步：取得 API 金鑰

1. Supabase 左側 → 「**Project Settings**」→「**API**」
2. 記下：
   - **Project URL**：例如 `https://kzcmxwqklzrrmixjgesq.supabase.co`
   - **anon public**：很長的一串 `eyJ...`

### 第五步：部署到 Vercel

1. **Fork 本專案**
   - 到本專案的 GitHub 頁面，點右上角「**Fork**」

2. **匯入到 Vercel**
   - 前往 [vercel.com](https://vercel.com)，用 GitHub 登入
   - 點「**Add New Project**」
   - 選擇剛才 Fork 的專案
   - **Root Directory** 改為 `classroom`
   - 展開「**Environment Variables**」，新增兩個：
     | Name | Value |
     |------|-------|
     | `VITE_SUPABASE_URL` | 你的 Project URL |
     | `VITE_SUPABASE_ANON_KEY` | 你的 anon public key |
   - 點「**Deploy**」

3. 部署完成後，記下你的網址，例如 `https://my-classroom.vercel.app`

### 第六步：更新 Supabase 的允許網址

1. Supabase → 「**Authentication**」→「**URL Configuration**」
2. 填入：
   - **Site URL**：`https://my-classroom.vercel.app`（你的 Vercel 網址）
3. **Redirect URLs** 點「Add URL」填入：
   - `https://my-classroom.vercel.app/auth/callback`
4. 點「Save」

### 第七步：設定 Email 通知（可選）

若不需要 Email 通知，可跳過此步驟。

1. 到 [resend.com](https://resend.com) 申請帳號
2. 左側「**API Keys**」→「**Create API Key**」，複製金鑰
3. Supabase 左側 → 「**Edge Functions**」→「**Secrets**」
4. 點「New secret」填入：
   - Name：`RESEND_API_KEY`
   - Value：剛才複製的金鑰
5. 在終端機執行：
   ```bash
   npx supabase functions deploy send-email --project-ref 你的ProjectID
   ```

---

## 使用方式

### 老師端
1. 用 Google 登入 → 選「我是老師」
2. 建立課程，取得 6 位課程碼
3. 把課程碼給學生，讓學生加入
4. 新增作業（可設定是否即刻釋出）

### 學生端
1. 用 Google 登入 → 選「我是學生」
2. 輸入老師給的課程碼加入課程
3. 依序完成作業

---

## 本地開發

```bash
# 安裝依賴
cd classroom
npm install

# 複製環境變數範本
cp .env.example .env.local
# 編輯 .env.local，填入你的 Supabase 憑證

# 啟動開發伺服器
npm run dev
```

---

## 技術架構

```
Vue 3 + TypeScript + Vite
  ↓
Supabase JS Client
  ├── Auth          (Google OAuth)
  ├── PostgreSQL    (課程、作業、提交、討論)
  ├── Storage       (作業附件)
  ├── Realtime      (討論即時更新)
  └── Edge Function (Email 通知)
```

---

## 授權

MIT License — 自由使用、修改、商業應用
