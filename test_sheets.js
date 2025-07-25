const { google } = require('googleapis');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function findSubmission(submissionId) {
    try {
        console.log('Searching for submission:', submissionId);
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A:Z',
        });
        
        const rows = response.data.values;
        if (!rows) {
            console.log('No data found in Google Sheets');
            return;
        }
        
        console.log('Total rows:', rows.length);
        
        // Search for submission ID in column N (index 13)
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][13] === submissionId) {
                console.log('Found submission at row:', i + 1);
                console.log('Row data:', rows[i]);
                console.log('Payment info (columns U-Y):', {
                    status: rows[i][20] || 'empty',
                    amount: rows[i][21] || 'empty', 
                    payment_date: rows[i][22] || 'empty',
                    payment_link: rows[i][23] || 'empty',
                    transaction_id: rows[i][24] || 'empty'
                });
                return;
            }
        }
        
        console.log('Submission ID not found');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

findSubmission('6883aea1662e3d788d0f120f');
