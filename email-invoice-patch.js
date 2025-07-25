// Email Invoice Enhancement Script for server.js
const fs = require('fs');

function addEmailInvoiceFeature() {
  try {
    let serverContent = fs.readFileSync('server.js', 'utf8');
    
    // Check if email invoice is already implemented
    if (serverContent.includes('customer_email') && serverContent.includes('send_email')) {
      console.log('✅ Email invoice functionality already exists');
      return;
    }
    
    console.log('📝 Adding email invoice functionality...');
    
    // 1. Add email validation function near other utility functions
    const emailValidationFunction = `
// Email validation utility function
function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email.toString().trim());
}

// Enhanced customer info extraction for LiqPay
function extractCustomerInfo(userData) {
  const customerInfo = {};
  
  // Extract and validate email
  const rawEmail = userData.email;
  if (rawEmail && validateEmail(rawEmail)) {
    customerInfo.customer_email = rawEmail.toString().trim().toLowerCase();
    customerInfo.send_email = true; // Enable email invoice
  }
  
  // Extract customer name
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
`;
    
    // Find a good place to insert the functions (after other utility functions)
    const insertPoint = serverContent.indexOf('// LiqPay') !== -1 ? 
                       serverContent.indexOf('// LiqPay') : 
                       serverContent.indexOf('function') !== -1 ?
                       serverContent.indexOf('function') :
                       serverContent.indexOf('const express');
    
    if (insertPoint !== -1) {
      serverContent = serverContent.slice(0, insertPoint) + 
                     emailValidationFunction + 
                     serverContent.slice(insertPoint);
    }
    
    // 2. Enhance payment data generation to include email invoice parameters
    // Look for LiqPay payment data creation and enhance it
    serverContent = serverContent.replace(
      /(\s*)(const\s+paymentData\s*=\s*{[^}]*)(})/g,
      (match, indent, paymentDataStart, closingBrace) => {
        if (match.includes('customer_email')) {
          return match; // Already enhanced
        }
        
        const enhancement = `${indent}  
${indent}  // Email invoice parameters
${indent}  ...extractCustomerInfo(userData),`;
        
        return paymentDataStart + enhancement + '\n' + indent + closingBrace;
      }
    );
    
    // 3. Add logging for email invoice functionality
    const loggingEnhancement = `
    // Log email invoice status
    if (userData.email && validateEmail(userData.email)) {
      logger.info('Email invoice enabled', { 
        email: userData.email, 
        submission_id: userData.submission_id 
      });
    } else {
      logger.warn('Email invoice disabled - invalid or missing email', { 
        submission_id: userData.submission_id 
      });
    }`;
    
    // Add logging after payment link generation
    serverContent = serverContent.replace(
      /(Generated payment link for submission)/g,
      loggingEnhancement + '\n    logger.info("$1"'
    );
    
    // 4. Backup and write the enhanced version
    fs.writeFileSync('server.js.backup-before-email-invoice', fs.readFileSync('server.js'));
    fs.writeFileSync('server.js', serverContent);
    
    console.log('✅ Email invoice functionality added successfully!');
    console.log('📋 Features added:');
    console.log('  - Email validation function');
    console.log('  - Customer info extraction');
    console.log('  - Automatic email invoice enabling');
    console.log('  - Enhanced logging');
    console.log('💾 Backup created: server.js.backup-before-email-invoice');
    
  } catch (error) {
    console.error('❌ Error enhancing server.js:', error);
  }
}

addEmailInvoiceFeature();
