// LiqPay Email Invoice Enhancement Functions
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
    console.log(`✅ Email invoice enabled for: ${customerInfo.customer_email}`);
  } else {
    console.log(`⚠️  Email invoice disabled - invalid email: ${rawEmail}`);
  }
  
  // Extract customer name for better invoice
  if (userData.display_name) {
    customerInfo.customer_name = userData.display_name;
  } else if (userData.name) {
    customerInfo.customer_name = userData.name;
  } else if (userData.first_name && userData.last_name) {
    customerInfo.customer_name = `${userData.first_name} ${userData.last_name}`;
  }
  
  // Extract phone if available
  if (userData.phone) {
    customerInfo.customer_phone = userData.phone;
  }
  
  return customerInfo;
}

// Enhanced LiqPay payment data generator with email invoice
function generateLiqPayDataWithEmail(userData, amount, orderId) {
  const customerInfo = extractCustomerInfo(userData);
  
  const paymentData = {
    version: '3',
    action: 'pay',
    amount: amount,
    currency: 'UAH',
    description: 'UCS25 registration',
    order_id: orderId,
    
    // Email invoice parameters - THIS IS THE KEY ADDITION
    ...customerInfo,
    
    // Goods description for better invoice
    goods: JSON.stringify([{
      name: 'UCS25 Conference Registration',
      price: amount,
      count: 1
    }]),
    
    // Result URLs
    result_url: `${process.env.SERVER_URL}/payment-result`,
    server_url: `${process.env.SERVER_URL}/webhook/liqpay`,
  };
  
  return paymentData;
}

module.exports = {
  validateEmail,
  extractCustomerInfo,
  generateLiqPayDataWithEmail
};
