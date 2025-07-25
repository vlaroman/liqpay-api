const { google } = require('googleapis');
require('dotenv').config();

async function setupGoogleSheets() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Prepare the header array with proper spacing for our updated structure
        const headers = new Array(25).fill(''); // Create array with 25 elements (A-Y)
        
        // Set headers for participant data columns
        headers[0] = 'Name';                     // Column A
        headers[1] = 'Email';                    // Column B  
        headers[2] = 'Phone';                    // Column C
        headers[3] = 'Registration Category';    // Column D
        headers[4] = 'Participation Type';       // Column E
        headers[5] = 'Education';                // Column F
        headers[6] = 'Specialty';                // Column G
        headers[7] = 'Workplace';                // Column H
        headers[8] = 'Position';                 // Column I
        headers[9] = 'City';                     // Column J
        headers[10] = 'Region';                  // Column K
        headers[11] = 'Country';                 // Column L
        headers[12] = 'Birth Date';              // Column M
        
        // Set headers for submission tracking
        headers[13] = 'Submission ID';           // Column N (for lookup)
        
        // Set headers for payment tracking
        headers[20] = 'Payment Status';          // Column U
        headers[21] = 'Payment Amount';          // Column V  
        headers[22] = 'Payment Date';            // Column W
        headers[23] = 'Payment Link';            // Column X
        headers[24] = 'Transaction ID';          // Column Y
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A1:Y1',
            valueInputOption: 'RAW',
            resource: {
                values: [headers]
            }
        });
        
        console.log('✅ Google Sheets headers updated successfully!');
        console.log('');
        console.log('📊 Participant Data Columns:');
        console.log('  Column A: Name');
        console.log('  Column B: Email');
        console.log('  Column C: Phone');
        console.log('  Column D: Registration Category');
        console.log('  Column E: Participation Type');
        console.log('  Column F: Education');
        console.log('  Column G: Specialty');
        console.log('  Column H: Workplace');
        console.log('  Column I: Position');
        console.log('  Column J: City');
        console.log('  Column K: Region');
        console.log('  Column L: Country');
        console.log('  Column M: Birth Date');
        console.log('');
        console.log('🔍 Lookup Column:');
        console.log('  Column N: Submission ID');
        console.log('');
        console.log('💳 Payment Tracking Columns:');
        console.log('  Column U: Payment Status');
        console.log('  Column V: Payment Amount');
        console.log('  Column W: Payment Date');
        console.log('  Column X: Payment Link');
        console.log('  Column Y: Transaction ID');
        
    } catch (error) {
        console.error('❌ Error setting up Google Sheets:', error);
        if (error.message.includes('Unable to parse range')) {
            console.log('💡 Make sure your spreadsheet exists and the service account has access');
        }
    }
}

setupGoogleSheets();
