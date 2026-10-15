# 作業附件與 CLI 1.1

每份作業可存放多個教材附件，檔案存放在現有 Supabase 專案的私人 Storage，不使用 Google Drive。這是老師提供的作業教材，學生繳交檔案不在這次修改範圍。

## 使用方式

教師新增作業時可選擇多個附件；編輯作業時可以選檔或拖曳上傳、下載、刪除。編輯頁的附件操作會立即儲存，無須再按「儲存變更」。學生在作業內容下方看到可下載的附件清單。

每個檔案最大 25 MiB（介面簡稱 25 MB）。支援 PDF、Word、Excel、PowerPoint、Markdown、文字、CSV、ZIP、PNG/JPEG/WebP、MP3/M4A/WAV、MP4，以及 JSON/Python/JavaScript/TypeScript/YAML/TOML/lock 等教材檔案。不提供附件線上編輯或完整格式預覽。

CLI 沿用既有 API Key 與 Base URL 設定，無須 Supabase service-role key：

```bash
# 列出附件，取得附件 ID
classroom attachments list --assignment 作業ID

# 同一作業可一次上傳多個檔案
classroom attachments upload --assignment 作業ID --file "講義.md" "練習素材.zip"

# 下載，未指定 output 時使用原始檔名，存到目前目錄
classroom attachments download 附件ID --output "下載/講義.md"

# 目的檔案已存在時，預設拒絕覆寫；明確需要覆寫才加此參數
classroom attachments download 附件ID --output "下載/講義.md" --force

# 傳輸成功但確認回應中斷時，可重試確認，不用重傳
classroom attachments complete 附件ID

# 教師刪除附件
classroom attachments delete 附件ID --yes
```

所有子指令支援 `--json`。上傳的 JSON 回傳 `{ uploaded, errors }`；部分失敗會保留成功檔案，並以非零退出碼結束。不要重傳已成功的項目。下載先寫入同目錄暫存檔並核對位元組數，再原子性寫入目的檔案；目標資料夾須先存在。

## 首次啟用（需獨立核准正式環境變更）

1. 審閱 [assignment-attachments-setup.sql](./assignment-attachments-setup.sql)。先在獨立測試 Supabase 專案套用，確認目前 Storage policies 沒有對所有 bucket 放行的規則。此 SQL 是一次性設定檔，不會由建置自動執行。
2. 確認後，在正式 Supabase 專案執行設定檔一次：建立 `assignment_attachments` 資料表、索引與 `assignment-attachments` 私人 bucket。已建立時不要重複執行；SQL 使用 transaction，遇到衝突會回復本次變更。
3. 依現有流程部署 `classroom/` 的網頁與 API。沿用既有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`；service-role key 只存在後端，不能改成 `VITE_` 變數。
4. CLI 指向包含新 API 的網站。若原先以 `npm link` 連到本專案，原有 `classroom` 指令會直接使用新版程式；其他安裝來源需另行更新。
5. 在測試環境以課程教師上傳實際附件，測試學生下載及其他課程帳號拒絕存取，再正式開放使用。

尚未套用 SQL 或部署 API 時，新附件區塊會顯示錯誤訊息；原有作業內容仍可閱讀。版本 1.1 的 CLI 需要新版 API 才能操作附件。

## 儲存與授權設計

- API：`GET /api/attachments?assignmentId=...` 列表；`POST /api/attachments` 取得上傳 URL；`POST /api/attachments?id=...&action=complete` 完成確認；`GET /api/attachments?id=...&action=download` 取得下載 URL；`DELETE /api/attachments?id=...` 刪除。
- 登入 JWT 與 classroom API Key 共用同一處授權。僅課程擁有教師可管理附件；學生需為該課程成員、作業已啟用且到達發布時間、排序位置已解鎖，才能列出與下載完成檔案。
- 解鎖位置沿用現有 `course_members.current_assignment_index`。既有進度欄位由學生端更新，本次沒有重新設計整個繳交與進度權限模型；若需防止刻意修改自己的進度，應另外將進度更新移到受控後端。
- 附件資料表啟用 RLS 且撤銷前端角色的資料表權限；API 驗證身分及上述權限後，以服務角色存取。Storage 不開放匿名或 authenticated 直接操作。
- 檔案路徑為 `作業ID/隨機附件ID.副檔名`，同名檔案互不覆寫。副檔名決定傳輸 MIME，後端核對儲存服務回報的大小與 MIME 後才標記 `ready`；這不等同病毒掃描或內容格式鑑定。
- 檔案直接 PUT 到 Storage，避免經過應用程式 API 的大型請求內容。上傳簽名依 Supabase 服務規則有效 2 小時，不能覆寫已存在物件；下載連結有效 60 秒，取得連結的人在有效期內皆可下載，因此不寫入日誌或永久存入資料表。
- 上傳失敗保留 `pending` 記錄，老師可重試確認或刪除後重傳。刪除失敗保留 `deleting` 記錄，供重試；學生看不到這兩種狀態。
- 刪除作業前需先清除其附件，資料庫外鍵會擋住有附件的作業刪除。儲存服務與資料庫沒有跨服務 transaction；若已簽發的上傳 URL 在刪除後才被使用，可能留下無對應記錄的物件。維運清理時應等待簽名到期（至少 2 小時）後再比對附件記錄與 Storage，不能直接刪除 `storage.objects` 資料列。

## 驗證

```bash
cd classroom
npm run build
npm run check:api
npm run test:attachments
```

自動測試只使用記憶體假資料與暫存檔，封鎖外部 fetch，且不傳入真實環境變數。涵蓋教師流程、跨課程拒絕、學生解鎖、容量與格式檢查、失敗恢復及 CLI 下載防覆寫。

`tests/attachments-schema.sql` 是只能用在全新、可拋棄 PostgreSQL 的測試：會建立角色及最小假結構，驗證 SQL、資料表權限、容量與刪除保護。它不能用來驗證完整 Supabase Storage 服務，也不能在正式資料庫執行。

`tests/attachments-browser.html` 是本機介面測試頁，需以假的 Supabase URL/key 啟動開發伺服器。頁面在記憶體模擬附件 API，可操作手機版多檔上傳與刪除，不會被 Vite 的正式建置打包。

參考：[Supabase 私人儲存](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[簽名上傳](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)。
