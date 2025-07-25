const { google } = require('googleapis');
require('dotenv').config();

async function setupGoogleSheets() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // First, let's check if there are already headers
        const currentData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A1:Z1'
        });
        
        const currentHeaders = currentData.data.values?.[0] || [];
        console.log('Current headers found:', currentHeaders.length);
        
        // Prepare the header array with proper spacing
        const headers = new Array(25).fill(''); // Create array with 25 elements (A-Y)
        
        // Set specific headers for payment columns
        headers[13] = 'Submission ID';        // Column N (index 13)
        headers[20] = 'Payment Status';       // Column U (index 20)
        headers[21] = 'Payment Amount';       // Column V (index 21)
        headers[22] = 'Payment Date';         // Column W (index 22)
        headers[23] = 'Payment Link';         // Column X (index 23)
        headers[24] = 'Transaction ID';       // Column Y (index 24)
        
        // Preserve existing headers and only update payment-related columns
        const finalHeaders = [...currentHeaders];
        
        // Extend array if needed
        while (finalHeaders.length < 25) {
            finalHeaders.push('');
        }
        
        // Update only payment-related headers
        finalHeaders[13] = headers[13]; // Column N
        finalHeaders[20] = headers[20]; // Column U
        finalHeaders[21] = headers[21]; // Column V
        finalHeaders[22] = headers[22]; // Column W
        finalHeaders[23] = headers[23]; // Column X
        finalHeaders[24] = headers[24]; // Column Y
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A1:Y1',
            valueInputOption: 'RAW',
            resource: {
                values: [finalHeaders]
            }
        });
        
        console.log('✅ Google Sheets headers updated successfully!');
        console.log('Payment-related headers added:');
        console.log('  Column N: Submission ID');
        console.log('  Column U: Payment Status');
        console.log('  Column V: Payment Amount');
        console.log('  Column W: Payment Date');
        console.log('  Column X: Payment Link');
        console.log('  Column Y: Transaction ID');
        
        // Add a sample test row to verify structure
        const testRow = new Array(25).fill('');
        testRow[13] = 'test_submission_001';    // Column N
        testRow[20] = 'PENDING';                // Column U
        testRow[21] = '1000';                   // Column V
        testRow[22] = new Date().toISOString(); // Column W
        testRow[23] = 'https://test-payment-link.com'; // Column X
        testRow[24] = '';                       // Column Y
        
        // Check if test row already exists
        const testCheck = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!N2:N2'
        });
        
        if (!testCheck.data.values || testCheck.data.values[0]?.[0] !== 'test_submission_001') {
            await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: 'Sheet1!A:Y',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [testRow]
                }
            });
            console.log('✅ Test row added for verification');
        } else {
            console.log('ℹ️  Test row already exists');
        }
        
    } catch (error) {
        console.error('❌ Error setting up Google Sheets:', error);
        if (error.message.includes('Unable to parse range')) {
            console.log('💡 Make sure your spreadsheet exists and the service account has access');
        }
    }
}

setupGoogleSheets();
