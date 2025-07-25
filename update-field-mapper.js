// Updated Paperform field mapper using score as payment amount
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
    result.email = fieldMap['Email'] || fieldMap['3f0t8'];
    
    // Construct full name from Ukrainian fields
    const lastName = fieldMap['Прізвище'] || fieldMap['d060k'] || '';
    const firstName = fieldMap["Ім'я, по батькові"] || fieldMap['al8s7'] || '';
    result.name = `${lastName} ${firstName}`.trim();
    
    // Extract phone
    result.phone = fieldMap['Номер мобільного телефону'] || fieldMap['7ptd4'];
    
    // Extract registration category for informational purposes
    result.registration_category = fieldMap['Оберіть категорію реєстрації'] || fieldMap['ft4qu'];
    result.participation_type = fieldMap['Оберіть форму участі'] || fieldMap['3kdd7'];
    
    // Get amount from score field - THIS IS THE KEY CHANGE!
    const scoreValue = fieldMap['Score'] || fieldMap['score'];
    
    // Handle different score value types
    if (scoreValue === false || scoreValue === null || scoreValue === undefined) {
        result.amount = '0'; // Free registration
        result.needs_payment = false;
    } else if (typeof scoreValue === 'number') {
        result.amount = scoreValue.toString();
        result.needs_payment = scoreValue > 0;
    } else if (typeof scoreValue === 'string') {
        const numValue = parseFloat(scoreValue);
        result.amount = isNaN(numValue) ? '0' : numValue.toString();
        result.needs_payment = !isNaN(numValue) && numValue > 0;
    } else {
        // Fallback - try to parse as number
        result.amount = '0';
        result.needs_payment = false;
    }
    
    // Extract other useful fields
    result.education = fieldMap['Освіта'] || fieldMap['96r0b'];
    result.specialty = fieldMap['Спеціальність'] || fieldMap['a7bh0'];
    result.workplace = fieldMap['Місце роботи'] || fieldMap['6dcfo'];
    result.position = fieldMap['Посада'] || fieldMap['hmcd'];
    result.city = fieldMap['Місто'] || fieldMap['dm65f'];
    result.region = fieldMap['Область'] || fieldMap['8vllu'];
    result.country = fieldMap['Країна'] || fieldMap['fj267'];
    result.birth_date = fieldMap['Дата народження'] || fieldMap['62k2f'];
    
    return result;
}

module.exports = { extractPaperformData };
