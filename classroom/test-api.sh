#!/bin/bash

# API 測試腳本
# 使用方式：./test-api.sh <API_KEY> <BASE_URL>

set -e

API_KEY="${1:-cl_teacher_test_key}"
BASE_URL="${2:-http://localhost:5173}"

echo "========================================"
echo "API 測試腳本"
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:20}..."
echo "========================================"

# 輔色函數
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"

    echo ""
    echo "🧪 測試: $name"
    echo "   $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "   ✅ 成功 (HTTP $http_code)"
        echo "   回應:"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    else
        echo "   ❌ 失敗 (HTTP $http_code)"
        echo "   錯誤:"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        return 1
    fi
}

# 1. 測試使用者資訊
test_api "取得使用者資訊" "GET" "/api/me"

# 2. 測試課程列表
test_api "取得課程列表" "GET" "/api/courses"

# 3. 測試作業列表（需要提供真實 courseId）
echo ""
echo "⚠️  跳過作業測試（需要真實 courseId）"
echo "   如需測試，請修改腳本並提供真實的 courseId"

# 以下測試需要真實的 UUID，請根據實際情況修改：
# COURSE_ID="your-course-id-here"
# test_api "取得作業列表" "GET" "/api/assignments?courseId=$COURSE_ID"
# test_api "建立作業" "POST" "/api/assignments" '{"courseId":"'$COURSE_ID'","title":"測試作業","description":"這是一個測試作業","isActive":true}'

echo ""
echo "========================================"
echo "測試完成！"
echo "========================================"
