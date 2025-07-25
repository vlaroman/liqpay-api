const { google } = require('googleapis');
require('dotenv').config();

async function addMissingSubmission() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // The submission data from the logs
        const submissionData = {
            submission_id: "6883aea1662e3d788d0f120f",
            name: "Романенко Вллодимир",
            email: "vr@pain.ua",
            phone: "0951004655",
            registration_category: "Лікарі – 1500 грн",
            participation_type: "Очно в Києві",
            education: "Вища немедична",
            specialty: "Неврологія",
            workplace: "Медбуд",
            position: "Лікар",
            city: "Київ",
            region: "Київ",
            country: "Україна",
            birth_date: "1986-12-12",
            amount: "1500"
        };
        
        // The payment link from the logs
        const paymentLink = "https://www.liqpay.ua/api/3/checkout?data=eyJwdWJsaWNfa2V5Ijoic2FuZGJveF9pMTk1ODczMzQ5NzciLCJ2ZXJzaW9uIjoiMyIsImFjdGlvbiI6InBheSIsImFtb3VudCI6IjE1MDAiLCJjdXJyZW5jeSI6IlVBSCIsImRlc2NyaXB0aW9uIjoiQ29uZmVyZW5jZSByZWdpc3RyYXRpb24gLSDQoNC%2B0LzQsNC90LXQvdC60L4g0JLQu9C70L7QtNC40LzQuNGAIiwib3JkZXJfaWQiOiI2ODgzYWVhMTY2MmUzZDc4OGQwZjEyMGYiLCJzZXJ2ZXJfdXJsIjoiaHR0cHM6Ly9wYXkuY29uZnkuY2Mvd2ViaG9vay9saXFwYXkiLCJyZXN1bHRfdXJsIjoiaHR0cHM6Ly9wYXkuY29uZnkuY2MvcGF5bWVudC1yZXN1bHQiLCJsYW5ndWFnZSI6InVrIiwiY3VzdG9tZXIiOiJ2ckBwYWluLnVhIiwic2FuZGJveCI6IjEifQ%3D%3D&signature=23vLQrhv8vyNaNslnqZZ%2BCIe7YA%3D";
        
        // Prepare row data for columns A-Y (25 columns total)
        const rowData = new Array(25).fill('');
        
        // Fill submission data
        rowData[0] = submissionData.name;               // Column A: Name
        rowData[1] = submissionData.email;              // Column B: Email
        rowData[2] = submissionData.phone;              // Column C: Phone
        rowData[3] = submissionData.registration_category; // Column D: Registration Category
        rowData[4] = submissionData.participation_type; // Column E: Participation Type
        rowData[5] = submissionData.education;          // Column F: Education
        rowData[6] = submissionData.specialty;          // Column G: Specialty
        rowData[7] = submissionData.workplace;          // Column H: Workplace
        rowData[8] = submissionData.position;           // Column I: Position
        rowData[9] = submissionData.city;               // Column J: City
        rowData[10] = submissionData.region;            // Column K: Region
        rowData[11] = submissionData.country;           // Column L: Country
        rowData[12] = submissionData.birth_date;        // Column M: Birth Date
        rowData[13] = submissionData.submission_id;     // Column N: Submission ID
        
        // Payment columns
        rowData[20] = 'PENDING';                        // Column U: Payment Status
        rowData[21] = submissionData.amount;            // Column V: Payment Amount
        rowData[22] = new Date().toISOString();         // Column W: Payment Date
        rowData[23] = paymentLink;                      // Column X: Payment Link
        rowData[24] = '';                               // Column Y: Transaction ID
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A:Y',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });
        
        console.log('✅ Successfully added missing submission to Google Sheets!');
        console.log('📊 Submission Details:');
        console.log(`  Name: ${submissionData.name}`);
        console.log(`  Email: ${submissionData.email}`);
        console.log(`  Phone: ${submissionData.phone}`);
        console.log(`  Amount: ${submissionData.amount} UAH`);
        console.log(`  Status: PENDING`);
        console.log(`  Payment Link: ${paymentLink.substring(0, 80)}...`);
        
    } catch (error) {
        console.error('❌ Error adding submission to Google Sheets:', error);
    }
}

addMissingSubmission();
