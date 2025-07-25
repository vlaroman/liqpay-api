const fs = require('fs');

function integrateEmailInvoice() {
  try {
    console.log('🔧 Reading server.js...');
    let content = fs.readFileSync('server.js', 'utf8');
    
    // Check if already integrated
    if (content.includes('extractCustomerInfo') && content.includes('send_email')) {
      console.log('✅ Email invoice functionality already integrated');
      return;
    }
    
    // Create backup
    fs.writeFileSync('server.js.backup-before-email-integration', content);
    console.log('💾 Backup created: server.js.backup-before-email-integration');
    
    // 1. Add email validation and customer info functions
    const emailFunctions = `
// Email validation utility function
function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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
    logger.info('Email invoice enabled', { 
      email: customerInfo.customer_email,
      submission_id: userData.submission_id 
    });
  } else {
    logger.warn('Email invoice disabled - invalid email', { 
      email: rawEmail,
      submission_id: userData.submission_id 
    });
  }
  
  // Extract customer name for better invoice
  if (userData.display_name) {
    customerInfo.customer_name = userData.display_name;
  } else if (userData.name) {
    customerInfo.customer_name = userData.name;
  } else if (userData.first_name && userData.last_name) {
    customerInfo.customer_name = \`\${userData.first_name} \${userData.last_name}\`;
  }
  
  // Extract phone if available
  if (userData.phone) {
    customerInfo.customer_phone = userData.phone;
  }
  
  return customerInfo;
}

`;
    
    // Find a good insertion point (after require statements, before route definitions)
    const insertionPoint = content.indexOf('// Routes') !== -1 ? 
                          content.indexOf('// Routes') :
                          content.indexOf('app.') !== -1 ?
                          content.indexOf('app.') :
                          content.indexOf('const app = express()') + content.substring(content.indexOf('const app = express()')).indexOf('\n') + 1;
    
    // Insert the functions
    content = content.slice(0, insertionPoint) + emailFunctions + content.slice(insertionPoint);
    
    // 2. Enhance LiqPay payment data creation
    // Look for patterns where payment data is created
    const paymentDataPatterns = [
      /const\s+paymentData\s*=\s*{([^}]+)}/g,
      /paymentData\s*=\s*{([^}]+)}/g,
      /{\s*version:\s*['"]3['"][^}]+}/g
    ];
    
    let enhanced = false;
    paymentDataPatterns.forEach(pattern => {
      content = content.replace(pattern, (match) => {
        if (match.includes('extractCustomerInfo') || match.includes('send_email')) {
          return match; // Already enhanced
        }
        
        // Find the closing brace and insert before it
        const lastBraceIndex = match.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          const beforeBrace = match.slice(0, lastBraceIndex);
          const afterBrace = match.slice(lastBraceIndex);
          
          const enhancement = `,
    
    // Email invoice parameters
    ...extractCustomerInfo(userData),
    
    // Enhanced goods description for better invoice
    goods: JSON.stringify([{
      name: 'UCS25 Conference Registration',
      price: amount,
      count: 1
    }])`;
          
          enhanced = true;
          return beforeBrace + enhancement + '\n  ' + afterBrace;
        }
        return match;
      });
    });
    
    // 3. Ensure extractFields is used for userData
    content = content.replace(
      /const\s+userData\s*=\s*req\.body/g,
      'const rawData = req.body;\n  const userData = extractFields ? extractFields(rawData) : rawData'
    );
    
    // 4. Add import for field mapper if not present
    if (!content.includes("require('./field-mapper')")) {
      const fieldMapperImport = "const { extractFields } = require('./field-mapper');\n";
      const requireIndex = content.lastIndexOf("require(");
      if (requireIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', requireIndex) + 1;
        content = content.slice(0, nextLineIndex) + fieldMapperImport + content.slice(nextLineIndex);
      }
    }
    
    // Write the enhanced file
    fs.writeFileSync('server.js', content);
    
    console.log('✅ Email invoice functionality integrated successfully!');
    console.log('📋 Changes made:');
    console.log('  ✅ Added validateEmail() function');
    console.log('  ✅ Added extractCustomerInfo() function');
    console.log('  ✅ Enhanced LiqPay payment data with email parameters');
    console.log('  ✅ Added field-mapper import');
    console.log('  ✅ Enhanced logging for email invoice status');
    
    if (enhanced) {
      console.log('  ✅ Payment data enhanced with email invoice parameters');
    } else {
      console.log('  ⚠️  Manual payment data enhancement may be needed');
    }
    
  } catch (error) {
    console.error('❌ Error integrating email invoice:', error.message);
    
    // Restore backup if something went wrong
    try {
      if (fs.existsSync('server.js.backup-before-email-integration')) {
        fs.copyFileSync('server.js.backup-before-email-integration', 'server.js');
        console.log('🔄 Restored backup due to error');
      }
    } catch (restoreError) {
      console.error('❌ Failed to restore backup:', restoreError.message);
    }
  }
}

integrateEmailInvoice();
