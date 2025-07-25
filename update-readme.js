const fs = require('fs');

function updateReadme() {
  try {
    let readme = fs.readFileSync('README.md', 'utf8');
    
    // Check if restart info already exists
    if (readme.includes('pm2 restart payment-processor')) {
      console.log('✅ Payment processor restart info already in README');
      return;
    }
    
    // Add restart information to deployment section
    const restartSection = `
## Payment Processor Management

### Restart the Payment Processor
After making changes to the code or configuration:

\`\`\`bash
pm2 restart payment-processor
\`\`\`

### Check Status
\`\`\`bash
pm2 status
pm2 logs payment-processor
\`\`\`

### Full Process Management
\`\`\`bash
# Start the processor
pm2 start server.js --name payment-processor

# Stop the processor
pm2 stop payment-processor

# View real-time logs
pm2 logs payment-processor --lines 50
\`\`\`

`;
    
    // Find deployment section or create one
    if (readme.includes('## Deployment')) {
      // Insert after deployment section
      readme = readme.replace(
        /(## Deployment[\s\S]*?)(\n## )/,
        '$1' + restartSection + '$2'
      );
    } else {
      // Add before support section or at the end
      if (readme.includes('## Support')) {
        readme = readme.replace('## Support', restartSection + '## Support');
      } else {
        readme += restartSection;
      }
    }
    
    // Also update the recent updates section with email invoice info
    const emailInvoiceUpdate = `
### v1.4 (July 2025)
- **Email Invoice Integration**: Automatically enables LiqPay email invoices with user's email pre-filled
- **Enhanced Field Mapping**: Improved email extraction and validation from Paperform data
- **Customer Info Enhancement**: Better invoice generation with customer name and phone
- **Process Management**: Added PM2 restart instructions for easy deployment`;
    
    // Insert the new version info
    if (readme.includes('### v1.3 (July 2025)')) {
      readme = readme.replace(
        '### v1.3 (July 2025)',
        emailInvoiceUpdate + '\n\n### v1.3 (July 2025)'
      );
    } else if (readme.includes('## Recent Updates')) {
      readme = readme.replace(
        '## Recent Updates',
        '## Recent Updates' + emailInvoiceUpdate
      );
    }
    
    fs.writeFileSync('README.md', readme);
    console.log('✅ README updated with payment processor restart information');
    console.log('📋 Added sections:');
    console.log('  ✅ Payment Processor Management');
    console.log('  ✅ PM2 restart commands');
    console.log('  ✅ Process management commands');
    console.log('  ✅ Email invoice integration info');
    
  } catch (error) {
    console.error('❌ Error updating README:', error.message);
  }
}

updateReadme();
