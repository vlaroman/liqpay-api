const fs = require('fs');

function fixLiqPayEmailInvoice() {
  try {
    let content = fs.readFileSync('server.js', 'utf8');
    
    console.log('🔧 Fixing LiqPay email invoice parameters...');
    
    // 1. Change customer: email to customer_email: email
    content = content.replace(/customer: email,/g, 'customer_email: email,');
    
    // 2. Add send_email: true parameter right after customer_email
    content = content.replace(
      /customer_email: email,/g, 
      'customer_email: email,\n            send_email: true,'
    );
    
    // 3. Update function signature to accept userData
    content = content.replace(
      'async function createPaymentLink(orderId, amount, email, description)',
      'async function createPaymentLink(orderId, amount, email, description, userData = {})'
    );
    
    // 4. Add customer_name parameter
    content = content.replace(
      'customer_email: email,\n            send_email: true,',
      'customer_email: email,\n            send_email: true,\n            customer_name: userData.name || description,'
    );
    
    // 5. Add customer_phone if available
    content = content.replace(
      'customer_name: userData.name || description,',
      'customer_name: userData.name || description,\n            customer_phone: userData.phone,'
    );
    
    // 6. Update the function call to pass userData (only the first occurrence in webhook)
    content = content.replace(
      /paymentLink = await createPaymentLink\(\s*submissionData\.submission_id,\s*submissionData\.amount,\s*submissionData\.email,\s*submissionData\.name\s*\);/,
      `paymentLink = await createPaymentLink(
                submissionData.submission_id, 
                submissionData.amount, 
                submissionData.email, 
                submissionData.name,
                submissionData
            );`
    );
    
    fs.writeFileSync('server.js', content);
    
    console.log('✅ LiqPay email invoice parameters fixed!');
    console.log('📋 Changes made:');
    console.log('  ✅ Changed customer to customer_email');
    console.log('  ✅ Added send_email: true');
    console.log('  ✅ Added customer_name parameter');
    console.log('  ✅ Added customer_phone parameter');
    console.log('  ✅ Updated function signature');
    console.log('  ✅ Updated function call with userData');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing LiqPay email invoice:', error.message);
    return false;
  }
}

if (fixLiqPayEmailInvoice()) {
  console.log('🚀 Ready to restart payment processor!');
} else {
  console.log('❌ Fix failed - please check manually');
}
