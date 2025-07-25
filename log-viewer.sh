#!/bin/bash

echo "=== Payment Processor System Log Viewer ==="
echo ""

case $1 in
    "combined"|"")
        echo "📋 Combined Logs (last 20 lines):"
        echo "=================================="
        tail -20 logs/combined.log | jq -r '.timestamp + " [" + .level + "] " + .message + " - " + (.requestId // "N/A")'
        ;;
    "access")
        echo "🌐 Access Logs (last 20 lines):"
        echo "==============================="
        tail -20 logs/access.log
        ;;
    "error")
        echo "❌ Error Logs:"
        echo "=============="
        if [ -s logs/error.log ]; then
            tail -20 logs/error.log | jq -r '.timestamp + " [ERROR] " + .message'
        else
            echo "No errors logged."
        fi
        ;;
    "webhooks")
        echo "🔗 Webhook Logs (last 20 lines):"
        echo "================================="
        tail -20 logs/webhooks.log | jq -r '.timestamp + " [" + .level + "] " + .message + " - " + (.requestId // "N/A")'
        ;;
    "live")
        echo "📡 Live Combined Logs (press Ctrl+C to exit):"
        echo "=============================================="
        tail -f logs/combined.log | jq -r '.timestamp + " [" + .level + "] " + .message + " - " + (.requestId // "N/A")'
        ;;
    "help")
        echo "Usage: ./log-viewer.sh [type]"
        echo ""
        echo "Available log types:"
        echo "  combined  - All application logs (default)"
        echo "  access    - HTTP access logs"
        echo "  error     - Error logs only"
        echo "  webhooks  - Webhook-related logs"
        echo "  live      - Live tail of combined logs"
        echo "  help      - Show this help"
        ;;
    *)
        echo "Unknown log type: $1"
        echo "Run './log-viewer.sh help' for available options"
        ;;
esac
