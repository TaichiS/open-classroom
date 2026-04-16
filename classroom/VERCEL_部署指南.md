# Vercel 部署指南

## 問題現況

### 為什麼 git push 後沒有自動部署？

**根本原因：Vercel 專案的 Root Directory 設定錯誤。**

你的 Git 倉庫結構是：

```
作業管理系統/          ← Git 倉庫根目錄
├── classroom/         ← Vue + API 專案在這裡（有 package.json）
├── vue-app/
├── vue-app-cdn/
├── supabase/
└── README.md
```

但 Vercel 目前把 Root Directory 設成 `.`（倉庫根目錄），導致它 push 後在根目錄找不到 `package.json` 和 `vite.config.ts`，因此無法觸發建置。

---

## 修復方案（推薦）：重新從 Git 導入

由於目前 `classroom` 專案可能存在狀態損壞（本地部署也會報 "Unexpected error"），**最穩固的做法是刪除舊專案、重新用 Git 導入**。

### 步驟 1：刪除舊專案（可選但推薦）

1. 登入 Vercel Dashboard：
   ```
   https://vercel.com/chialungchan-gmailcoms-projects/classroom/settings
   ```

2. 捲到最下方找到 **"Delete Project"**
3. 輸入專案名稱 `classroom` 確認刪除

> ⚠️ 刪除專案不會影響 GitHub 倉庫或程式碼，只會移除 Vercel 上的部署記錄和設定。

### 步驟 2：重新 Import Git Repository

1. 前往 Vercel Dashboard 首頁：
   ```
   https://vercel.com/new
   ```

2. 選擇你的 GitHub repo：`TaichiS/open-classroom`
3. 在導入設定頁面，找到 **"Root Directory"** 欄位
4. 輸入：`classroom`
5. Framework Preset 應該會自動偵測為 **Vite**
6. 確認 Build Command 是 `npm run build`
7. 點擊 **Deploy**

### 步驟 3：設定環境變數

部署完成後，進入新專案的 **Settings → Environment Variables**，加入以下變數：

| 名稱 | 值 | 環境 |
|------|-----|------|
| `SUPABASE_URL` | `https://kzcmxwqklzrrmixjgesq.supabase.co` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Production, Preview |
| `VITE_SUPABASE_URL` | `https://kzcmxwqklzrrmixjgesq.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Production, Preview |

> 💡 這些值可以從舊專案的 Environment Variables 複製，或從 Supabase Dashboard 取得。

### 步驟 4：測試自動部署

1. 修改一個小檔案（例如改個註解）
2. `git add . && git commit -m "test: trigger vercel deploy" && git push origin main`
3. 回到 Vercel Dashboard，應該會看到新的 Deployment 開始建置

---

## 替代方案：不改變專案，只用本地 CLI 手動部署

如果你暫時不想刪除舊專案，可以透過 CLI 手動部署：

```bash
cd classroom

# 方式 1：直接部署（會建立 Preview Deployment）
vercel deploy --yes

# 方式 2：部署到 Production
vercel deploy --prod --yes

# 方式 3：本地建置後上傳預建結果
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

> ⚠️ **已知問題**：目前 `classroom` 原專案透過 CLI 直接部署會出現 `Error: Unexpected error. Please try again later. ()`，這是專案層級的狀態問題，重新 Import Git Repository 後會解決。

---

## 如何驗證 Root Directory 是否正確？

### 方法 1：看最新 Deployment 的 Build Log

1. 進入 Vercel Dashboard → Deployments
2. 點擊最新的 Deployment
3. 查看 Build 步驟中的 `Running build in ...`
4. 如果正確，應該會看到類似：
   ```
   Running "npm run build"
   > open-classroom@1.0.0 build
   > vue-tsc && vite build
   ```
   而且建置會成功完成。

### 方法 2：檢查產出的 Functions

成功的部署會在 Build Log 中顯示 Lambda functions：
```
λ api/me
λ api/courses
λ api/assignments/index
...
```

如果 Root Directory 錯誤，Build 會直接失敗或找不到 `package.json`。

---

## 常見問題

### Q: 為什麼 `vercel project inspect` 顯示 Root Directory 是 `.`？
A: 因為這個專案最初是透過 CLI 建立的，Vercel 預設把上傳路徑的根目錄當作 Root Directory。需要透過 Dashboard 的 Git Import 流程才能正確設定子目錄為 Root Directory。

### Q: 刪除專案後，自訂域名會不會遺失？
A: 會。如果你有自訂域名綁定在 `classroom` 專案上，刪除後需要在新專案中重新綁定。

### Q: 可以用 `vercel.json` 設定 Root Directory 嗎？
A: **不行**。`rootDirectory` 是 Vercel 專案層級的設定，無法透過 `vercel.json` 修改。

### Q: git push 後沒有觸發部署，但沒有 Build Error？
A: 這通常表示 Vercel 根本沒有收到 Git webhook。請確認：
1. GitHub repo 的 Settings → Webhooks 中有 Vercel 的 webhook
2. Vercel 專案的 Git Connection 沒有斷開
3. Root Directory 設定正確（最重要）

---

## 快速檢查清單

- [ ] Vercel 專案的 Root Directory 設為 `classroom`
- [ ] Git Integration 正常連結到 `TaichiS/open-classroom`
- [ ] 環境變數 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 已設定
- [ ] `git push origin main` 後能在 Vercel Dashboard 看到新 Deployment
- [ ] API endpoint `/api/me` 能正確回應 JSON（非 TypeScript 原始碼）
