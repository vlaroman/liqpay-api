// Enhanced LiqPay payment with email invoice
function generatePaymentWithEmailInvoice(userData, amount) {
  const liqpay = new LiqPay(publicKey, privateKey);
  
  // Extract email from Paperform data
  const userEmail = userData.email || userData['Email Address'] || userData.email_address;
  
  const paymentData = {
    version: '3',
    action: 'pay',
    amount: amount,
    currency: 'UAH',
    description: 'UCS25 registration',
    order_id: userData.submission_id,
    
    // Email invoice parameters
    customer_email: userEmail,    // Auto-populate email
    send_email: true,            // Enable email invoice
    
    // Customer info for better invoices
    customer_name: userData.name || `${userData.first_name} ${userData.last_name}`,
    customer_phone: userData.phone,
    
    // Result URLs
    result_url: `${process.env.SERVER_URL}/payment-result`,
    server_url: `${process.env.SERVER_URL}/webhook/liqpay`,
  };
  
  // Generate payment form HTML or redirect URL
  const formHtml = liqpay.cnb_form(paymentData);
  
  return {
    paymentForm: formHtml,
    paymentData: paymentData
  };
}

// Usage in webhook handler
app.post('/webhook/paperform', async (req, res) => {
  try {
    const formData = req.body;
    const userEmail = extractUserEmail(formData); // Extract from Paperform data
    const amount = formData.score; // Use score field for amount
    
    // Generate payment with email invoice
    const payment = generatePaymentWithEmailInvoice(formData, amount);
    
    // Store payment link and email in Google Sheets
    await updateGoogleSheet(formData.submission_id, {
      payment_link: payment.paymentForm,
      customer_email: userEmail,
      email_invoice_enabled: true,
      amount: amount
    });
    
    res.json({ success: true, email_invoice: true });
  } catch (error) {
    console.error('Payment generation error:', error);
    res.status(500).json({ error: 'Payment generation failed' });
  }
});
