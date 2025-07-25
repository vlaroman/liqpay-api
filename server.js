const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston');
const morgan = require('morgan');
require('dotenv').config();

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'payment-processor' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.File({ filename: 'logs/webhooks.log', level: 'info' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

const app = express();

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Paperform field mapper utility - UPDATED TO USE SCORE AS AMOUNT
function extractPaperformData(formData) {
    const dataFields = formData.data || [];
    const result = {};
    
    // Create a lookup map for easy access
    const fieldMap = {};
    dataFields.forEach(field => {
        fieldMap[field.key] = field.value;
        fieldMap[field.title] = field.value;
    });
    
    // Extract standard fields
    result.submission_id = formData.submission_id;
    result.email = fieldMap["Email"] || fieldMap["3f0t8"];
    
    // Construct full name from Ukrainian fields
    const lastName = fieldMap["Прізвище"] || fieldMap["d060k"] || "";
    const firstName = fieldMap["Ім'я, по батькові"] || fieldMap["al8s7"] || "";
    result.name = `${lastName} ${firstName}`.trim();
    
    // Extract phone
    result.phone = fieldMap["Номер мобільного телефону"] || fieldMap["7ptd4"];
    
    // Extract registration category for informational purposes
    result.registration_category = fieldMap["Оберіть категорію реєстрації"] || fieldMap["ft4qu"];
    result.participation_type = fieldMap["Оберіть форму участі"] || fieldMap["3kdd7"];
    
    // Get amount from score field - THIS IS THE KEY CHANGE!
    const scoreValue = fieldMap["Score"] || fieldMap["score"];
    
    // Handle different score value types
    if (scoreValue === false || scoreValue === null || scoreValue === undefined) {
        result.amount = "0"; // Free registration
        result.needs_payment = false;
    } else if (typeof scoreValue === "number") {
        result.amount = scoreValue.toString();
        result.needs_payment = scoreValue > 0;
    } else if (typeof scoreValue === "string") {
        const numValue = parseFloat(scoreValue);
        result.amount = isNaN(numValue) ? "0" : numValue.toString();
        result.needs_payment = !isNaN(numValue) && numValue > 0;
    } else {
        // Fallback - try to parse as number
        result.amount = "0";
        result.needs_payment = false;
    }
    
    // Extract other useful fields
    result.education = fieldMap["Освіта"] || fieldMap["96r0b"];
    result.specialty = fieldMap["Спеціальність"] || fieldMap["a7bh0"];
    result.workplace = fieldMap["Місце роботи"] || fieldMap["6dcfo"];
    result.position = fieldMap["Посада"] || fieldMap["hmcd"];
    result.city = fieldMap["Місто"] || fieldMap["dm65f"];
    result.region = fieldMap["Область"] || fieldMap["8vllu"];
    result.country = fieldMap["Країна"] || fieldMap["fj267"];
    result.birth_date = fieldMap["Дата народження"] || fieldMap["62k2f"];
    
    return result;
}

// Morgan HTTP request logging
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {
    stream: fs.createWriteStream('./logs/access.log', { flags: 'a' })
}));

// Morgan console logging
app.use(morgan('combined'));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to log all requests
app.use((req, res, next) => {
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    req.requestId = requestId;
    
    logger.info('Incoming Request', {
        requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
        ip: req.ip
    });
    
    // Override res.json to log outgoing responses
    const originalJson = res.json;
    res.json = function(body) {
        logger.info('Outgoing Response', {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            body: body
        });
        return originalJson.call(this, body);
    };
    
    next();
});

// Configuration
const LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY;
const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const BASE_URL = process.env.BASE_URL || 'https://pay.confy.cc';

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// LiqPay signature generation
function generateLiqPaySignature(data) {
    const signString = LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY;
    return crypto.createHash('sha1').update(signString).digest('base64');
}

// Create LiqPay payment data
function createLiqPayData(params) {
    const data = JSON.stringify(params);
    return Buffer.from(data).toString('base64');
}

// Find row in Google Sheets by submission ID (Column N)
async function findRowBySubmissionId(submissionId) {
    try {
        logger.info('Searching for submission ID in Google Sheets', { submissionId });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:Z',
        });
        
        const rows = response.data.values;
        if (!rows) {
            logger.warn('No data found in Google Sheets', { submissionId });
            return null;
        }
        
        // Search for submission ID in column N (index 13)
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][13] === submissionId) {
                logger.info('Found submission in Google Sheets', { 
                    submissionId, 
                    rowNumber: i + 1 
                });
                return i + 1;
            }
        }
        
        logger.warn('Submission ID not found in Google Sheets', { submissionId });
        return null;
    } catch (error) {
        logger.error('Error finding row in Google Sheets', { 
            submissionId, 
            error: error.message,
            stack: error.stack 
        });
        return null;
    }
}

// Add new submission to Google Sheets
async function addSubmissionToGoogleSheets(submissionData) {
    try {
        logger.info('Adding new submission to Google Sheets', { 
            submissionId: submissionData.submission_id 
        });
        
        // Prepare row data for columns A-Y (25 columns total)
        const rowData = new Array(25).fill('');
        
        // Fill submission data
        rowData[13] = submissionData.submission_id;     // Column N: Submission ID
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
        
        // Payment columns
        rowData[20] = submissionData.needs_payment ? 'PENDING' : 'FREE'; // Column U: Payment Status
        rowData[21] = submissionData.amount;            // Column V: Payment Amount
        rowData[22] = new Date().toISOString();         // Column W: Payment Date
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:Y',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });
        
        logger.info('Successfully added submission to Google Sheets', { 
            submissionId: submissionData.submission_id 
        });
        return true;
    } catch (error) {
        logger.error('Error adding submission to Google Sheets', { 
            submissionId: submissionData.submission_id,
            error: error.message,
            stack: error.stack 
        });
        return false;
    }
}

// Update Google Sheets with payment info (Columns U-Y)
async function updatePaymentInfo(submissionId, paymentData) {
    try {
        logger.info('Updating payment info in Google Sheets', { 
            submissionId, 
            paymentData 
        });
        
        const rowNumber = await findRowBySubmissionId(submissionId);
        if (!rowNumber) {
            logger.error('Cannot update payment info - row not found', { submissionId });
            return false;
        }
        
        const range = `Sheet1!U${rowNumber}:Y${rowNumber}`;
        const values = [[
            paymentData.status || '',
            paymentData.amount || '',
            paymentData.payment_date || '',
            paymentData.payment_link || '',
            paymentData.transaction_id || ''
        ]];
        
        logger.info('Updating Google Sheets range', { 
            submissionId, 
            range, 
            values 
        });
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: { values }
        });
        
        logger.info('Successfully updated payment info in Google Sheets', { 
            submissionId, 
            rowNumber 
        });
        return true;
    } catch (error) {
        logger.error('Error updating Google Sheets', { 
            submissionId, 
            paymentData,
            error: error.message,
            stack: error.stack 
        });
        return false;
    }
}

// Webhook endpoint for Paperform submissions
app.post('/webhook/paperform', async (req, res) => {
    try {
        const formData = req.body;
        logger.info('Received Paperform webhook', { 
            requestId: req.requestId,
            formData 
        });
        
        // Extract data using our field mapper
        const submissionData = extractPaperformData(formData);
        
        logger.info('Extracted submission data', {
            requestId: req.requestId,
            submissionData
        });
        
        if (!submissionData.submission_id) {
            logger.error('Missing submission_id in Paperform webhook', { 
                requestId: req.requestId,
                formData 
            });
            return res.status(400).json({ error: 'Missing submission_id' });
        }
        
        // Add submission to Google Sheets first
        
        let paymentLink = null;
        
        // Only create payment link if payment is needed
        if (submissionData.needs_payment) {
            logger.info('Creating payment link for paid registration', {
                requestId: req.requestId,
                submissionId: submissionData.submission_id,
                amount: submissionData.amount
            });
            
            paymentLink = await createPaymentLink(
                submissionData.submission_id, 
                submissionData.amount, 
                submissionData.email, 
                submissionData.name
            );
            
            // Update with payment link
            await updatePaymentInfo(submissionData.submission_id, {
                status: 'PENDING',
                amount: submissionData.amount,
                payment_link: paymentLink,
                payment_date: new Date().toISOString()
            });
        } else {
            logger.info('Free registration - no payment needed', {
                requestId: req.requestId,
                submissionId: submissionData.submission_id,
                category: submissionData.registration_category
            });
            
            // Update payment info for free registration
            await updatePaymentInfo(submissionData.submission_id, {
                status: "FREE",
                amount: "0",
                payment_link: "",
                payment_date: new Date().toISOString()
            });
        }
        
        logger.info('Successfully processed Paperform submission', {
            requestId: req.requestId,
            submissionId: submissionData.submission_id,
            needsPayment: submissionData.needs_payment,
            paymentLink
        });
        
        res.json({ 
            success: true, 
            submission_id: submissionData.submission_id,
            needs_payment: submissionData.needs_payment,
            payment_link: paymentLink,
            amount: submissionData.amount,
            registration_category: submissionData.registration_category
        });
    } catch (error) {
        logger.error('Error processing Paperform webhook', { 
            requestId: req.requestId,
            error: error.message,
            stack: error.stack,
            body: req.body 
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create payment link
async function createPaymentLink(orderId, amount, email, description) {
    try {
        logger.info('Creating LiqPay payment link', {
            orderId,
            amount,
            email,
            description
        });
        
        const params = {
            public_key: LIQPAY_PUBLIC_KEY,
            version: '3',
            action: 'pay',
            amount: amount,
            currency: 'UAH',
            description: `UCS25 registration - ${description}`,
            order_id: orderId,
            server_url: `${BASE_URL}/webhook/liqpay`,
            result_url: `${BASE_URL}/pay/${orderId}`,
            language: 'uk',
            customer: email,
            sandbox: process.env.LIQPAY_SANDBOX === '1' ? '1' : '0'
        };
        
        const data = createLiqPayData(params);
        const signature = generateLiqPaySignature(data);
        const paymentUrl = `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;
        
        logger.info('Generated LiqPay payment link', {
            orderId,
            paymentUrl,
            liqpayParams: params
        });
        
        return paymentUrl;
    } catch (error) {
        logger.error('Error creating LiqPay payment link', {
            orderId,
            amount,
            email,
            description,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// LiqPay webhook endpoint
app.post('/webhook/liqpay', async (req, res) => {
    try {
        const { data, signature } = req.body;
        
        logger.info('Received LiqPay webhook', {
            requestId: req.requestId,
            data,
            signature,
            rawBody: req.body
        });
        
        // Verify signature
        const expectedSignature = generateLiqPaySignature(data);
        if (signature !== expectedSignature) {
            logger.error('Invalid LiqPay signature', {
                requestId: req.requestId,
                receivedSignature: signature,
                expectedSignature,
                data
            });
            return res.status(400).send('Invalid signature');
        }
        
        // Decode payment data
        const paymentData = JSON.parse(Buffer.from(data, 'base64').toString());
        
        logger.info('Decoded LiqPay payment data', {
            requestId: req.requestId,
            paymentData
        });
        
        // Update Google Sheets based on payment status
        if (paymentData.status === 'success' || paymentData.status === 'sandbox') {
            await updatePaymentInfo(paymentData.order_id, {
                status: 'COMPLETED',
                amount: paymentData.amount,
                payment_date: new Date().toISOString(),
                transaction_id: paymentData.transaction_id,
                payment_link: ''
            });
            
            logger.info('Payment completed successfully', {
                requestId: req.requestId,
                orderId: paymentData.order_id,
                transactionId: paymentData.transaction_id
            });
        } else if (paymentData.status === 'failure' || paymentData.status === 'error') {
            await updatePaymentInfo(paymentData.order_id, {
                status: 'FAILED',
                payment_date: new Date().toISOString(),
                transaction_id: paymentData.transaction_id
            });
            
            logger.warn('Payment failed', {
                requestId: req.requestId,
                orderId: paymentData.order_id,
                status: paymentData.status,
                transactionId: paymentData.transaction_id
            });
        }
        
        res.send('OK');
    } catch (error) {
        logger.error('Error processing LiqPay webhook', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).send('Error');
    }
});

// Payment status checker endpoint
app.get('/payment-status/:submissionId', async (req, res) => {
    try {
        const submissionId = req.params.submissionId;
        
        logger.info('Checking payment status', {
            requestId: req.requestId,
            submissionId
        });
        
        const rowNumber = await findRowBySubmissionId(submissionId);
        
        if (!rowNumber) {
            logger.warn('Submission not found for status check', {
                requestId: req.requestId,
                submissionId
            });
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!U${rowNumber}:Y${rowNumber}`,
        });
        
        const paymentInfo = response.data.values?.[0] || [];
        const result = {
            submission_id: submissionId,
            status: paymentInfo[0] || 'UNKNOWN',
            amount: paymentInfo[1] || '',
            payment_date: paymentInfo[2] || '',
            payment_link: paymentInfo[3] || '',
            transaction_id: paymentInfo[4] || ''
        };
        
        logger.info('Payment status retrieved', {
            requestId: req.requestId,
            submissionId,
            result
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Error checking payment status', {
            requestId: req.requestId,
            submissionId: req.params.submissionId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate new payment link for existing submission
app.post('/regenerate-payment/:submissionId', async (req, res) => {
    try {
        const submissionId = req.params.submissionId;
        const { amount, email, name } = req.body;
        
        logger.info('Regenerating payment link', {
            requestId: req.requestId,
            submissionId,
            amount,
            email,
            name
        });
        
        const rowNumber = await findRowBySubmissionId(submissionId);
        if (!rowNumber) {
            logger.warn('Cannot regenerate payment - submission not found', {
                requestId: req.requestId,
                submissionId
            });
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const paymentLink = await createPaymentLink(submissionId, amount, email, name);
        
        await updatePaymentInfo(submissionId, {
            status: 'PENDING',
            payment_link: paymentLink,
            payment_date: new Date().toISOString()
        });
        
        logger.info('Successfully regenerated payment link', {
            requestId: req.requestId,
            submissionId,
            paymentLink
        });
        
        res.json({ success: true, payment_link: paymentLink });
    } catch (error) {
        logger.error('Error regenerating payment link', {
            requestId: req.requestId,
            submissionId: req.params.submissionId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all pending payments (for monitoring)
app.get('/pending-payments', async (req, res) => {
    try {
        logger.info('Retrieving pending payments', {
            requestId: req.requestId
        });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:Z',
        });
        
        const rows = response.data.values;
        if (!rows) {
            return res.json({ pending_payments: [] });
        }
        
        const pendingPayments = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const submissionId = row[13];
            const paymentStatus = row[20];
            const paymentAmount = row[21];
            const paymentDate = row[22];
            const paymentLink = row[23];
            
            if (paymentStatus === 'PENDING' && submissionId) {
                pendingPayments.push({
                    submission_id: submissionId,
                    status: paymentStatus,
                    amount: paymentAmount,
                    payment_date: paymentDate,
                    payment_link: paymentLink,
                    row_number: i + 1
                });
            }
        }
        
        logger.info('Retrieved pending payments', {
            requestId: req.requestId,
            count: pendingPayments.length
        });
        
        res.json({ 
            pending_payments: pendingPayments,
            total_pending: pendingPayments.length
        });
    } catch (error) {
        logger.error('Error getting pending payments', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Payment result page
app.get('/payment-result', (req, res) => {
    logger.info('Payment result page accessed', {
        requestId: req.requestId,
        query: req.query
    });
    
    res.send(`
        <html>
            <head>
                <title>Payment Result</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .success { color: #28a745; }
                    .processing { color: #007bff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="processing">🔄 Payment Processing</h1>
                    <p>Your payment is being processed. You will receive a confirmation email shortly.</p>
                    <p>This window will close automatically in 5 seconds.</p>
                    <hr>
                    <p><small>Payment Processor System</small></p>
                </div>
                <script>
                    setTimeout(() => {
                        if (window.opener) {
                            window.close();
                        } else {
                            window.location.href = 'about:blank';
                        }
                    }, 5000);
                </script>
            </body>
        </html>
    `);
});

// Serve test form
app.get('/test', (req, res) => {
    logger.info('Test form accessed', {
        requestId: req.requestId
    });
    res.sendFile(__dirname + '/test-form.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthData = { 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        requestId: req.requestId
    };
    
    logger.info('Health check', {
        requestId: req.requestId,
        healthData
    });
    
    res.json(healthData);
});

// Logs endpoint (for monitoring)
app.get('/logs', (req, res) => {
    logger.info('Logs endpoint accessed', {
        requestId: req.requestId,
        query: req.query
    });
    
    const logType = req.query.type || 'combined';
    const lines = req.query.lines || '100';
    
    try {
        const logFile = `logs/${logType}.log`;
        if (fs.existsSync(logFile)) {
            const logContent = fs.readFileSync(logFile, 'utf8');
            const logLines = logContent.split('\n').slice(-parseInt(lines));
            
            res.setHeader('Content-Type', 'text/plain');
            res.send(logLines.join('\n'));
        } else {
            res.status(404).send('Log file not found');
        }
    } catch (error) {
        logger.error('Error reading log file', {
            requestId: req.requestId,
            error: error.message
        });
        res.status(500).send('Error reading log file');
    }
});

const PORT = process.env.PORT || 3050;
app.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV || 'development'
    });
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Test interface: https://pay.confy.cc/test`);
    console.log(`❤️  Health check: https://pay.confy.cc/health`);
    console.log(`📝 Logs: https://pay.confy.cc/logs`);
});

// Payment redirect endpoint - Main entry point for users after form submission
app.get('/pay/:submissionId', async (req, res) => {
    try {
        const submissionId = req.params.submissionId;
        
        logger.info('Payment redirect page accessed', {
            requestId: req.requestId,
            submissionId,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer')
        });
        
        // Check if submission exists and get payment status
        const rowNumber = await findRowBySubmissionId(submissionId);
        
        if (!rowNumber) {
            // Submission not found - show refresh page
            logger.warn('Submission not found for payment redirect', {
                requestId: req.requestId,
                submissionId
            });
            
            return res.send(generateNotFoundPage(submissionId));
        }
        
        // Get payment information from Google Sheets
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!U${rowNumber}:Y${rowNumber}`,
        });
        
        const paymentInfo = response.data.values?.[0] || [];
        const paymentStatus = paymentInfo[0] || 'UNKNOWN';
        const paymentAmount = paymentInfo[1] || '';
        const paymentDate = paymentInfo[2] || '';
        const paymentLink = paymentInfo[3] || '';
        const transactionId = paymentInfo[4] || '';
        
        logger.info('Retrieved payment information for redirect', {
            requestId: req.requestId,
            submissionId,
            paymentStatus,
            paymentAmount,
            hasPaymentLink: !!paymentLink
        });
        
        // Handle different payment statuses
        if (paymentStatus === 'COMPLETED') {
            // Payment already completed - show success page
            logger.info('Showing success page for completed payment', {
                requestId: req.requestId,
                submissionId,
                transactionId
            });
            
            return res.send(generateSuccessPage({
                submissionId,
                amount: paymentAmount,
                paymentDate,
                transactionId
            }));
            
        } else if (paymentStatus === 'PENDING' && paymentLink) {
            // Payment pending with link - redirect to LiqPay
            logger.info('Redirecting to LiqPay payment page', {
                requestId: req.requestId,
                submissionId,
                paymentLink
            });
            
            return res.redirect(paymentLink);
            
        } else if (paymentStatus === 'FREE') {
            // Free registration - show success page without payment details
            logger.info('Showing success page for free registration', {
                requestId: req.requestId,
                submissionId
            });
            
            return res.send(generateSuccessPage({
                submissionId,
                amount: '0',
                paymentDate,
                transactionId: '',
                isFree: true
            }));
            
        } else if (paymentStatus === 'FAILED') {
            // Payment failed - show error page with option to retry
            logger.warn('Showing failed payment page', {
                requestId: req.requestId,
                submissionId
            });
            
            return res.send(generateFailedPage(submissionId));
            
        } else {
            // Unknown status or no payment link - show refresh page
            logger.warn('Unknown payment status or missing link - showing refresh page', {
                requestId: req.requestId,
                submissionId,
                paymentStatus,
                hasPaymentLink: !!paymentLink
            });
            
            return res.send(generateNotFoundPage(submissionId));
        }
        
    } catch (error) {
        logger.error('Error processing payment redirect', {
            requestId: req.requestId,
            submissionId: req.params.submissionId,
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).send(generateErrorPage());
    }
});

// Helper function to generate "not found / refresh" page
function generateNotFoundPage(submissionId) {
    return `
        <!DOCTYPE html>
        <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Платіж не знайдено - Конференція</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #333;
                    }
                    
                    .container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        padding: 40px;
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }
                    
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                        display: block;
                    }
                    
                    h1 {
                        color: #ff9500;
                        font-size: 24px;
                        margin-bottom: 16px;
                        font-weight: 600;
                    }
                    
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                    
                    .submission-id {
                        background: #f8f9fa;
                        padding: 12px;
                        border-radius: 6px;
                        font-family: 'Monaco', 'Menlo', monospace;
                        font-size: 14px;
                        margin: 20px 0;
                        word-break: break-all;
                        color: #495057;
                        border: 1px solid #e9ecef;
                    }
                    
                    .refresh-btn {
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        font-size: 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        margin-top: 10px;
                    }
                    
                    .refresh-btn:hover {
                        background: #0056b3;
                        transform: translateY(-1px);
                    }
                    
                    .refresh-btn:active {
                        transform: translateY(0);
                    }
                    
                    .note {
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        border-radius: 6px;
                        padding: 16px;
                        margin-top: 24px;
                        color: #856404;
                        font-size: 14px;
                    }
                    
                    @media (max-width: 480px) {
                        .container {
                            padding: 24px;
                            margin: 20px;
                        }
                        
                        h1 {
                            font-size: 20px;
                        }
                        
                        .icon {
                            font-size: 48px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <span class="icon">🔍</span>
                    <h1>Платіж не знайдено</h1>
                    <p>Ми не змогли знайти інформацію про ваш платіж. Можливо, система ще обробляє вашу заявку.</p>
                    
                    <div class="submission-id">
                        ID заявки: ${submissionId}
                    </div>
                    
                    <button class="refresh-btn" onclick="window.location.reload()">
                        🔄 Оновити сторінку
                    </button>
                    
                    <div class="note">
                        <strong>💡 Підказка:</strong> Якщо ви щойно подали заявку, зачекайте кілька секунд та оновіть сторінку. Система може потребувати час для обробки.
                    </div>
                </div>
            </body>
        </html>
    `;
}

// Helper function to generate success page
function generateSuccessPage({ submissionId, amount, paymentDate, transactionId, isFree = false }) {
    const formattedDate = paymentDate ? new Date(paymentDate).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }) : '';
    const formattedAmount = amount ? parseFloat(amount).toLocaleString('uk-UA') : '0';
    
    return `
        <!DOCTYPE html>
        <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Реєстрація завершена - Конференція</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #333;
                    }
                    
                    .container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        padding: 40px;
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }
                    
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                        display: block;
                    }
                    
                    h1 {
                        color: #28a745;
                        font-size: 28px;
                        margin-bottom: 16px;
                        font-weight: 600;
                    }
                    
                    .subtitle {
                        color: #666;
                        font-size: 18px;
                        margin-bottom: 30px;
                        line-height: 1.4;
                    }
                    
                    .details {
                        background: #f8f9fa;
                        border-radius: 8px;
                        padding: 24px;
                        margin: 24px 0;
                        text-align: left;
                    }
                    
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 0;
                        border-bottom: 1px solid #e9ecef;
                    }
                    
                    .detail-row:last-child {
                        border-bottom: none;
                    }
                    
                    .detail-label {
                        font-weight: 500;
                        color: #495057;
                    }
                    
                    .detail-value {
                        font-family: 'Monaco', 'Menlo', monospace;
                        font-size: 14px;
                        color: #212529;
                        text-align: right;
                        max-width: 60%;
                        word-break: break-all;
                    }
                    
                    .amount {
                        font-size: 20px;
                        font-weight: 600;
                        color: #28a745;
                    }
                    
                    .free-badge {
                        background: #28a745;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    
                    .note {
                        background: #d4edda;
                        border: 1px solid #c3e6cb;
                        border-radius: 6px;
                        padding: 16px;
                        margin-top: 24px;
                        color: #155724;
                        font-size: 14px;
                    }
                    
                    @media (max-width: 480px) {
                        .container {
                            padding: 24px;
                            margin: 20px;
                        }
                        
                        h1 {
                            font-size: 24px;
                        }
                        
                        .icon {
                            font-size: 48px;
                        }
                        
                        .detail-row {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 4px;
                        }
                        
                        .detail-value {
                            max-width: 100%;
                            text-align: left;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <span class="icon">✅</span>
                    <h1>${isFree ? 'Реєстрація завершена!' : 'Платіж успішний!'}</h1>
                    <p class="subtitle">
                        ${isFree 
                            ? 'Ваша безкоштовна реєстрація на конференцію підтверджена.' 
                            : 'Дякуємо за сплату! Ваша реєстрація на конференцію підтверджена.'
                        }
                    </p>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="detail-label">ID заявки:</span>
                            <span class="detail-value">${submissionId}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Сума:</span>
                            <span class="detail-value ${isFree ? '' : 'amount'}">
                                ${isFree 
                                    ? '<span class="free-badge">БЕЗКОШТОВНО</span>' 
                                    : `${formattedAmount} ₴`
                                }
                            </span>
                        </div>
                        
                        ${formattedDate ? `
                        <div class="detail-row">
                            <span class="detail-label">${isFree ? 'Дата реєстрації:' : 'Дата платежу:'}</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                        ` : ''}
                        
                        ${transactionId ? `
                        <div class="detail-row">
                            <span class="detail-label">ID транзакції:</span>
                            <span class="detail-value">${transactionId}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="note">
                        <strong>📧 Важливо:</strong> Додаткова інформація буде надіслана на вашу електронну пошту напередодні заходу.
                    </div>
                </div>
            </body>
        </html>
    `;
}

// Helper function to generate failed payment page
function generateFailedPage(submissionId) {
    return `
        <!DOCTYPE html>
        <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Помилка платежу - Конференція</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #333;
                    }
                    
                    .container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        padding: 40px;
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }
                    
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                        display: block;
                    }
                    
                    h1 {
                        color: #dc3545;
                        font-size: 24px;
                        margin-bottom: 16px;
                        font-weight: 600;
                    }
                    
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                    
                    .submission-id {
                        background: #f8f9fa;
                        padding: 12px;
                        border-radius: 6px;
                        font-family: 'Monaco', 'Menlo', monospace;
                        font-size: 14px;
                        margin: 20px 0;
                        word-break: break-all;
                        color: #495057;
                        border: 1px solid #e9ecef;
                    }
                    
                    .retry-btn {
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        font-size: 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        margin-top: 10px;
                    }
                    
                    .retry-btn:hover {
                        background: #c82333;
                        transform: translateY(-1px);
                    }
                    
                    .note {
                        background: #f8d7da;
                        border: 1px solid #f5c6cb;
                        border-radius: 6px;
                        padding: 16px;
                        margin-top: 24px;
                        color: #721c24;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <span class="icon">❌</span>
                    <h1>Помилка платежу</h1>
                    <p>На жаль, платіж не вдалося завершити. Спробуйте ще раз або зверніться до підтримки.</p>
                    
                    <div class="submission-id">
                        ID заявки: ${submissionId}
                    </div>
                    
                    <button class="retry-btn" onclick="window.location.reload()">
                        🔄 Спробувати ще раз
                    </button>
                    
                    <div class="note">
                        <strong>⚠️ Увага:</strong> Якщо проблема повторюється, будь ласка, зверніться до організаторів конференції для вирішення питання.
                    </div>
                </div>
            </body>
        </html>
    `;
}

// Helper function to generate general error page
function generateErrorPage() {
    return `
        <!DOCTYPE html>
        <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Помилка сервера - Конференція</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #333;
                    }
                    
                    .container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        padding: 40px;
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }
                    
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                        display: block;
                    }
                    
                    h1 {
                        color: #6c757d;
                        font-size: 24px;
                        margin-bottom: 16px;
                        font-weight: 600;
                    }
                    
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <span class="icon">🔧</span>
                    <h1>Технічна помилка</h1>
                    <p>Виникла технічна помилка. Будь ласка, спробуйте пізніше або зверніться до підтримки.</p>
                </div>
            </body>
        </html>
    `;
}
