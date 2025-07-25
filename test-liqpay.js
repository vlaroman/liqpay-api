const crypto = require('crypto');
require('dotenv').config();

function generateLiqPaySignature(data) {
    const signString = process.env.LIQPAY_PRIVATE_KEY + data + process.env.LIQPAY_PRIVATE_KEY;
    return crypto.createHash('sha1').update(signString).digest('base64');
}

function createLiqPayData(params) {
    const data = JSON.stringify(params);
    return Buffer.from(data).toString('base64');
}

// Test payment creation
const params = {
    public_key: process.env.LIQPAY_PUBLIC_KEY,
    version: '3',
    action: 'pay',
    amount: '100',
    currency: 'UAH',
    description: 'Test Conference Registration',
    order_id: 'test_' + Date.now(),
    server_url: `${process.env.BASE_URL}/webhook/liqpay`,
    result_url: `${process.env.BASE_URL}/payment-result`,
    language: 'uk',
    customer: 'test@example.com',
    sandbox: process.env.LIQPAY_SANDBOX || '1'
};

const data = createLiqPayData(params);
const signature = generateLiqPaySignature(data);

console.log('Test LiqPay Payment Link:');
console.log(`https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`);
console.log('\nData object:');
console.log(JSON.stringify(params, null, 2));
