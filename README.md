# Paperform + LiqPay + Google Sheets Integration

This service integrates Paperform conference registration with LiqPay payment processing and Google Sheets tracking for UCS25 (Ukrainian Computing Society 2025) registration.

## Features

- ✅ Receives Paperform webhook submissions
- ✅ Generates LiqPay payment links automatically with UCS25 branding
- ✅ Updates Google Sheets with payment status
- ✅ Handles payment success/failure webhooks from LiqPay
- ✅ Provides payment status checking API
- ✅ Allows regenerating payment links for failed payments
- ✅ Uses Paperform's score field for dynamic payment amounts
- ✅ Displays timestamps in Ukrainian timezone (Europe/Kiev)

## Recent Updates

### v1.3 (July 2025)
- **Payment Description**: Updated from "Conference registration" to "UCS25 registration" for better branding
- **Timezone Fix**: Fixed timestamp display to show Ukrainian local time instead of UTC
- **Amount Detection**: Implemented use of Paperform's `score` field for payment amounts instead of category-based inference
- **Email Confirmation Text**: Updated Ukrainian text to specify additional information will be sent before the event

### Key Improvements
- **Dynamic Pricing**: System now uses the `score` parameter from Paperform webhooks as the payment amount, making pricing more flexible
- **Better UX**: Payment pages and confirmations now properly display Ukrainian time
- **Cleaner Code**: Removed hardcoded amount mappings in favor of direct score field usage

## Setup Instructions

### 1. LiqPay Setup
1. Get your LiqPay API keys from PrivatBank
2. Set up webhook URLs in LiqPay merchant account:
   - Server URL: `https://yourdomain.com/webhook/liqpay`
   - Result URL: `https://yourdomain.com/payment-result`

### 2. Google Sheets Setup
1. Create a Google Cloud Project and enable Google Sheets API
2. Create service account credentials and download JSON key file
3. Share your Google Sheet with the service account email
4. Set up the sheet with required columns (see field-mapper.js)

### 3. Paperform Setup
1. Configure webhook in Paperform to point to: `https://yourdomain.com/webhook/paperform`
2. Ensure the form includes a `score` field that represents the payment amount
3. Map form fields using the field-mapper.js configuration

### 4. Environment Configuration
Copy `.env.example` to `.env` and configure:

```
LIQPAY_PUBLIC_KEY=your_liqpay_public_key
LIQPAY_PRIVATE_KEY=your_liqpay_private_key
GOOGLE_SHEETS_ID=your_google_sheet_id
SERVER_URL=https://yourdomain.com
PORT=3000
```

## API Endpoints

### Webhooks
- `POST /webhook/paperform` - Receives Paperform submissions
- `POST /webhook/liqpay` - Handles LiqPay payment status updates

### Payment Operations
- `GET /payment-status/:submission_id` - Check payment status
- `POST /regenerate-payment/:submission_id` - Generate new payment link
- `GET /payment-result` - Payment success/failure page

### Utilities
- `GET /logs` - View application logs (requires authentication)

## Important Notes

### Payment Amount Logic
The system now uses Paperform's `score` field as the payment amount:
- **Before**: Amount was inferred from registration category text matching
- **After**: Amount comes directly from the `score` parameter in webhook payload
- This makes the system more flexible and eliminates hardcoded pricing logic

### Timezone Handling
All timestamps are displayed in Ukrainian time (Europe/Kiev):
- Server generates UTC timestamps
- Client-side JavaScript converts to Ukrainian timezone for display
- Ensures users see correct local time for registration and payment dates

### Data Flow
1. User submits Paperform → Creates row in Google Sheets
2. Paperform webhook → Updates payment details in existing row
3. Payment made → LiqPay webhook updates status
4. User can check status → API provides current payment state

## Troubleshooting

### Common Issues
1. **Duplicate Rows**: Ensure webhook only updates existing rows, doesn't create new ones
2. **Wrong Timezone**: Check JavaScript timezone formatting uses 'Europe/Kiev'
3. **Payment Amount**: Verify Paperform sends `score` field in webhook payload
4. **Sheet Access**: Confirm service account has edit permissions on Google Sheet

### Log Files
- Application logs: `logs/app.log`
- Access logs: `logs/access.log`
- Use `./log-viewer.sh` for real-time log monitoring

## Files Structure

- `server.js` - Main application server
- `field-mapper.js` - Paperform field mapping configuration
- `google-service-key.json` - Google Sheets service account credentials
- `.env` - Environment variables (not in repo)
- `logs/` - Application log files
- `test-*.js` - Testing utilities

## Deployment

See `DEPLOYMENT_CHECKLIST.md` for complete deployment instructions.
See `LOGGING_GUIDE.md` for logging configuration and monitoring.

## Support

For issues related to:
- **LiqPay Integration**: Check LiqPay merchant dashboard and webhook logs
- **Google Sheets**: Verify service account permissions and sheet structure
- **Paperform**: Ensure webhook URL is correctly configured and `score` field is present
