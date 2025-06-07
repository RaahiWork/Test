#!/bin/bash

# Manual Backup Test Script for EC2
# This script tests the /api/backup endpoint on your VybChat server

echo "🧪 VybChat Backup API Test Script"
echo "================================="

# Default values
PORT=${PORT:-3500}
HOST=${HOST:-localhost}

echo "🔍 Testing backup endpoint at http://${HOST}:${PORT}/api/backup"

# Test if server is running
echo "📡 Checking if server is responding..."
if curl -f -s "http://${HOST}:${PORT}/api/health" > /dev/null; then
    echo "✅ Server is responding"
else
    echo "❌ Server is not responding at http://${HOST}:${PORT}"
    echo "💡 Make sure your VybChat server is running"
    exit 1
fi

# Test backup endpoint
echo "💾 Calling backup endpoint..."
RESPONSE=$(curl -s -X POST "http://${HOST}:${PORT}/api/backup")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://${HOST}:${PORT}/api/backup")

echo "📊 HTTP Status Code: ${HTTP_CODE}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backup API call successful!"
    echo "📄 Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
    echo "❌ Backup API call failed"
    echo "📄 Response:"
    echo "$RESPONSE"
fi

echo ""
echo "🔍 Checking for backup files..."
if [ -f "chat-backup.json" ]; then
    echo "✅ Primary backup file exists"
    FILE_SIZE=$(stat -f%z "chat-backup.json" 2>/dev/null || stat -c%s "chat-backup.json" 2>/dev/null || echo "unknown")
    echo "📏 File size: ${FILE_SIZE} bytes"
else
    echo "⚠️ Primary backup file not found"
fi

# List recent backup files
echo ""
echo "📂 Recent backup files:"
ls -la chat-backup-*.json 2>/dev/null | head -5 || echo "No timestamped backup files found"

echo ""
echo "✅ Backup test completed!"
