# LiqPay Email Invoice Integration Guide

## Summary of Changes Made

### 1. ✅ Enhanced Field Mapper (`field-mapper.js`)
- Added comprehensive email field mapping
- Included email validation
- Enhanced field extraction with email prioritization
- Added display_name generation for invoices

### 2. 🔧 Server.js Integration Required

To integrate email invoice functionality, you need to:

#### A. Add the utility functions to server.js:
```javascript
// Add these functions to your server.js

// Email validation utility function
function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toString().trim());
}

// Enhanced customer info extraction for LiqPay email invoices
function extractCustomerInfo(userData) {
  const customerInfo = {};
  
  // Extract and validate email for invoice
  const rawEmail = userData.email;
  if (rawEmail && validateEmail(rawEmail)) {
    customerInfo.customer_email = rawEmail.toString().trim().toLowerCase();
    customerInfo.send_email = true; // Enable LiqPay email invoice
  }
  
  // Extract customer name for better invoice
  if (userData.display_name) {
    customerInfo.customer_name = userData.display_name;
  } else if (userData.name) {
    customerInfo.customer_name = userData.name;
  }
  
  // Extract phone if available
  if (userData.phone) {
    customerInfo.customer_phone = userData.phone;
  }
  
  return customerInfo;
}
```

#### B. Update your LiqPay payment data generation:
Find where you create the `paymentData` object and enhance it:

```javascript
// BEFORE (typical structure):
const paymentData = {
  version: '3',
  action: 'pay',
  amount: amount,
  currency: 'UAH',
  description: 'UCS25 registration',
  order_id: orderId,
  result_url: `${process.env.SERVER_URL}/payment-result`,
  server_url: `${process.env.SERVER_URL}/webhook/liqpay`,
};

// AFTER (with email invoice):
const paymentData = {
  version: '3',
  action: 'pay',
  amount: amount,
  currency: 'UAH',
  description: 'UCS25 registration',
  order_id: orderId,
  
  // EMAIL INVOICE ENHANCEMENT - ADD THESE LINES:
  ...extractCustomerInfo(userData),
  
  // Optional: Better goods description for invoice
  goods: JSON.stringify([{
    name: 'UCS25 Conference Registration',
    price: amount,
    count: 1
  }]),
  
  result_url: `${process.env.SERVER_URL}/payment-result`,
  server_url: `${process.env.SERVER_URL}/webhook/liqpay`,
};
```

#### C. Ensure proper field extraction in webhook handler:
Make sure you're using the enhanced field mapper:

```javascript
// In your Paperform webhook handler
const { extractFields } = require('./field-mapper');

app.post('/webhook/paperform', async (req, res) => {
  try {
    const formData = req.body;
    
    // Use enhanced field extraction (includes email validation)
    const userData = extractFields(formData);
    
    // Generate payment with email invoice
    const paymentData = {
      // ... your existing payment data
      ...extractCustomerInfo(userData), // This adds email invoice functionality
    };
    
    // ... rest of your payment processing
  } catch (error) {
    console.error('Payment generation error:', error);
  }
});
```

## 3. How It Works

### Email Invoice Process:
1. **Form Submission** → Paperform sends webhook with user data
2. **Email Extraction** → Enhanced field mapper finds and validates email
3. **Payment Generation** → LiqPay payment includes `customer_email` and `send_email: true`
4. **User Experience** → Email invoice toggle is automatically enabled with user's email pre-filled
5. **Payment Completion** → User receives invoice automatically via email

### LiqPay Parameters Added:
- `customer_email`: User's email from Paperform
- `send_email: true`: Enables email invoice sending
- `customer_name`: User's name for personalized invoice
- `customer_phone`: Optional phone number
- `goods`: Structured description for better invoice

## 4. Testing

To test the email invoice functionality:

1. **Test form submission** with a valid email
2. **Check generated payment link** - email should be pre-filled
3. **Complete test payment** - invoice should be sent to email
4. **Verify logs** for email validation messages

## 5. Benefits

✅ **Automatic Email Invoice**: No manual toggle needed
✅ **Pre-filled Email**: User's email from form automatically used
✅ **Better User Experience**: Seamless invoice delivery
✅ **Professional Invoices**: Includes proper customer details
✅ **Validation**: Email format validation prevents errors

## 6. Next Steps

1. **Integrate the functions** into your server.js
2. **Restart the payment processor**: `pm2 restart payment-processor`
3. **Test with a sample registration**
4. **Monitor logs** for email invoice status

## 7. Troubleshooting

- **Email not pre-filled**: Check field mapping and validation
- **Invoice not sent**: Verify `send_email: true` in payment data
- **Invalid email error**: Check email validation function
- **Missing customer name**: Ensure name fields are properly mapped

