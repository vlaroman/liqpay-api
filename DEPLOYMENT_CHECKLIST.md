# Deployment Checklist

## 1. LiqPay Configuration ✅
- [ ] Get LiqPay public and private keys from PrivatBank
- [ ] Test with sandbox first (LIQPAY_SANDBOX=1)
- [ ] Configure webhook URLs in LiqPay merchant panel:
  - Server URL: `https://yourdomain.com/webhook/liqpay`
  - Result URL: `https://yourdomain.com/payment-result`

## 2. Google Sheets Setup ✅
- [ ] Create Google Cloud project
- [ ] Enable Google Sheets API
- [ ] Create service account and download JSON key
- [ ] Share spreadsheet with service account email
- [ ] Run setup script: `node setup-sheets.js`

## 3. Paperform Configuration ✅
- [ ] Add webhook integration in Paperform
- [ ] Set webhook URL: `https://yourdomain.com/webhook/paperform`
- [ ] Test webhook delivery
- [ ] Ensure form includes required fields:
  - Submission ID (automatic)
  - Participant name
  - Email address
  - Payment amount (if variable)

## 4. Environment Setup ✅
- [ ] Copy `.env.example` to `.env`
- [ ] Fill all required environment variables
- [ ] Place Google service account JSON file in project directory
- [ ] Test configuration with: `node test-liqpay.js`

## 5. Server Deployment ✅
- [ ] Deploy to your server (VPS, cloud, etc.)
- [ ] Ensure HTTPS is enabled
- [ ] Set up process manager (PM2, systemd, etc.)
- [ ] Configure firewall rules
- [ ] Test all endpoints

## 6. Testing Workflow ✅
1. Test form submission → `/test` endpoint
2. Verify Google Sheets update
3. Test payment link generation
4. Test LiqPay sandbox payment
5. Verify webhook processing
6. Test payment status checking
7. Test payment link regeneration

## 7. Production Checklist ✅
- [ ] Switch to production LiqPay (LIQPAY_SANDBOX=0)
- [ ] Update webhook URLs to production domain
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Document support procedures

## Required Fields for LiqPay Integration

### From Paperform to your service:
- `submission_id` - Unique form submission identifier
- `name` or `first_name` + `last_name` - Participant name
- `email` - Participant email
- `amount` - Payment amount (optional, can use default)

### From your service to LiqPay:
- `public_key` - Your LiqPay public key
- `version` - "3"
- `action` - "pay"
- `amount` - Payment amount in UAH
- `currency` - "UAH"
- `description` - Payment description
- `order_id` - Unique order ID (use submission_id)
- `server_url` - Your webhook endpoint
- `result_url` - Payment result page
- `language` - "uk" or "en"
- `customer` - Customer email
- `sandbox` - "1" for testing, "0" for production

## Common Issues and Solutions

### Issue: Google Sheets permission denied
**Solution:** Make sure the service account email has edit access to your spreadsheet

### Issue: LiqPay signature mismatch
**Solution:** Verify your private key is correct and signature generation matches LiqPay docs

### Issue: Webhook not receiving data
**Solution:** Check firewall settings and ensure your server is accessible from the internet

### Issue: Payment link not working
**Solution:** Verify all required LiqPay parameters are included and correctly formatted

## Support Contacts
- LiqPay Support: https://www.liqpay.ua/support
- Paperform Support: https://paperform.co/help
- Google Sheets API: https://developers.google.com/sheets/api/support
