#!/bin/bash
# Startup script for PDF Flow Mobile App on Termux
cd "$(dirname "$0")"

PORT=5173
echo "=========================================="
echo " Starting PDF Flow - Mobile PDF Manager"
echo "=========================================="
echo "Local Server URL: http://localhost:$PORT"
echo "Network URL:      http://$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1 || echo "0.0.0.0"):$PORT"
echo "------------------------------------------"
echo "Press Ctrl+C to stop the server."
echo ""

./node_modules/.bin/vite --host 0.0.0.0 --port $PORT
