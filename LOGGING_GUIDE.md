# 📝 Payment Processor System - Logging Guide

Your application now has comprehensive logging capabilities that track all incoming and outgoing data.

## 🎯 What is Logged

### ✅ All HTTP Requests
- **Request ID**: Unique identifier for each request
- **Method**: GET, POST, etc.
- **URL**: Full request path with query parameters
- **Headers**: All HTTP headers
- **Body**: Complete request body (JSON data)
- **IP Address**: Client IP address
- **Timestamp**: Exact time of request

### ✅ All HTTP Responses
- **Request ID**: Links response to original request
- **Status Code**: HTTP response code (200, 404, 500, etc.)
- **Response Body**: Complete response data
- **Processing Time**: How long the request took

### ✅ Business Logic Events
- **Paperform Submissions**: Complete form data received
- **Payment Link Generation**: LiqPay parameters and URLs
- **Google Sheets Updates**: What data was written where
- **LiqPay Webhooks**: Payment status updates
- **Signature Verification**: Security validation events
- **Database Operations**: Success/failure of Google Sheets operations

### ✅ Error Tracking
- **Stack Traces**: Full error details
- **Context Data**: What was happening when error occurred
- **Request Information**: Which request caused the error

## 📂 Log Files Location

All logs are stored in the `logs/` directory:

```
logs/
├── access.log      # HTTP access logs (Apache format)
├── combined.log    # All application logs (JSON format)
├── error.log       # Error logs only (JSON format)
├── webhooks.log    # Webhook-specific logs (JSON format)
```

## 🔍 How to View Logs

### 1. Using the Web Interface
Visit: `https://pay.confy.cc/logs?type=combined&lines=100`

**Parameters:**
- `type`: combined, access, error, webhooks
- `lines`: number of lines to show (default: 100)

**Examples:**
- `https://pay.confy.cc/logs?type=error` - Show error logs
- `https://pay.confy.cc/logs?type=access&lines=50` - Last 50 access logs
- `https://pay.confy.cc/logs?type=webhooks` - Webhook logs only

### 2. Using Command Line Script
```bash
./log-viewer.sh [type]
```

**Available types:**
- `combined` - All application logs (default)
- `access` - HTTP access logs
- `error` - Error logs only
- `webhooks` - Webhook-related logs
- `live` - Live tail of logs (real-time)
- `help` - Show usage

**Examples:**
```bash
./log-viewer.sh combined    # View recent combined logs
./log-viewer.sh error       # View error logs
./log-viewer.sh live        # Watch logs in real-time
```

### 3. Direct File Access
```bash
# View recent combined logs
tail -f logs/combined.log | jq

# View access logs
tail -f logs/access.log

# Search for specific submission ID
grep "conf_2024_001" logs/combined.log
```

### 4. PM2 Logs (Console Output)
```bash
pm2 logs payment-processor          # View live logs
pm2 logs payment-processor --lines 100  # Last 100 lines
```

## 🔍 Example Log Entries

### Incoming Paperform Webhook
```json
{
  "timestamp": "2025-07-25T15:30:00.000Z",
  "level": "info",
  "message": "Received Paperform webhook",
  "requestId": "1753458000000-abc123",
  "formData": {
    "submission_id": "conf_2024_001",
    "name": "John Doe",
    "email": "john@example.com",
    "amount": "1500"
  }
}
```

### Payment Link Generation
```json
{
  "timestamp": "2025-07-25T15:30:01.000Z",
  "level": "info",
  "message": "Generated LiqPay payment link",
  "orderId": "conf_2024_001",
  "paymentUrl": "https://www.liqpay.ua/api/3/checkout?data=...",
  "liqpayParams": {
    "amount": "1500",
    "currency": "UAH",
    "description": "Conference registration - John Doe"
  }
}
```

### LiqPay Webhook
```json
{
  "timestamp": "2025-07-25T15:35:00.000Z",
  "level": "info",
  "message": "Payment completed successfully",
  "requestId": "1753458300000-xyz789",
  "orderId": "conf_2024_001",
  "transactionId": "liqpay_tx_123456"
}
```

## 🚨 Error Tracking

All errors are logged with full context:

```json
{
  "timestamp": "2025-07-25T15:30:00.000Z",
  "level": "error",
  "message": "Error updating Google Sheets",
  "submissionId": "conf_2024_001",
  "error": "The caller does not have permission",
  "stack": "Error: The caller does not have permission\n    at..."
}
```

## 📊 Monitoring & Alerts

### Log Rotation
Logs will grow over time. Consider setting up log rotation:

```bash
# Add to crontab for daily rotation
0 0 * * * /usr/sbin/logrotate -f /path/to/logrotate.conf
```

### Real-time Monitoring
For production monitoring, you can:

1. **Watch for errors:**
   ```bash
   tail -f logs/error.log
   ```

2. **Monitor webhook activity:**
   ```bash
   ./log-viewer.sh live | grep webhook
   ```

3. **Check payment completions:**
   ```bash
   grep "Payment completed" logs/combined.log
   ```

## 🔒 Security Notes

- **Sensitive Data**: Payment card details are never logged
- **Signatures**: LiqPay signatures are logged for debugging
- **Personal Data**: Names and emails are logged (consider GDPR compliance)
- **API Keys**: Private keys are never logged in plain text

## 🎛️ Log Levels

- **info**: Normal operations, requests, responses
- **warn**: Non-critical issues, missing data
- **error**: Failures, exceptions, critical issues

## 📈 Performance Monitoring

Each request gets a unique `requestId` that you can use to trace the complete flow:

1. Paperform webhook received
2. Google Sheets lookup
3. Payment link generation
4. Google Sheets update
5. Response sent

This allows you to identify bottlenecks and debug issues effectively.

## 🛠️ Troubleshooting Common Issues

### Issue: No logs appearing
**Solution:** Check PM2 logs and ensure application is running
```bash
pm2 status
pm2 logs payment-processor
```

### Issue: Permission errors in logs
**Solution:** Check Google Sheets service account permissions

### Issue: LiqPay signature errors
**Solution:** Verify your private key in `.env` file

### Issue: Large log files
**Solution:** Set up log rotation or periodically archive old logs
```bash
# Archive old logs
tar -czf logs-$(date +%Y%m%d).tar.gz logs/*.log
> logs/*.log  # Clear current logs
```
