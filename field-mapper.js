// Enhanced field mapping configuration for Paperform to Google Sheets
// Now includes email extraction for LiqPay invoice functionality

const fieldMapping = {
  // Personal Information
  name: ['name', 'Name', 'Full Name', 'full_name', 'participant_name'],
  first_name: ['first_name', 'First Name', 'firstName', 'given_name'],
  last_name: ['last_name', 'Last Name', 'lastName', 'family_name', 'surname'],
  
  // Email - Enhanced mapping for invoice functionality
  email: [
    'email', 'Email', 'Email Address', 'email_address', 
    'user_email', 'participant_email', 'contact_email',
    'registration_email', 'primary_email'
  ],
  
  // Contact Information
  phone: ['phone', 'Phone', 'Phone Number', 'phone_number', 'mobile', 'contact_phone'],
  
  // Organization/Affiliation
  organization: ['organization', 'Organization', 'company', 'Company', 'institution', 'affiliation'],
  position: ['position', 'Position', 'job_title', 'title', 'role'],
  
  // Registration Details
  registration_type: ['registration_type', 'Registration Type', 'category', 'participant_type'],
  submission_date: ['submission_date', 'created_at', 'timestamp', 'date_submitted'],
  
  // Payment Information
  amount: ['amount', 'score', 'payment_amount', 'total', 'price'],
  
  // Additional Fields
  special_requirements: ['special_requirements', 'dietary_requirements', 'accessibility_needs', 'notes'],
  country: ['country', 'Country'],
  city: ['city', 'City'],
};

// Enhanced field extraction function with email validation
function extractField(data, fieldMappings) {
  for (const mapping of fieldMappings) {
    if (data[mapping] !== undefined && data[mapping] !== null && data[mapping] !== '') {
      return data[mapping];
    }
  }
  return null;
}

// Email validation function
function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toString().trim());
}

// Enhanced field extraction with special handling for email
function extractFields(paperformData) {
  const extracted = {};
  
  // Extract all standard fields
  for (const [key, mappings] of Object.entries(fieldMapping)) {
    extracted[key] = extractField(paperformData, mappings);
  }
  
  // Special handling for email - validate and clean
  const rawEmail = extracted.email;
  if (rawEmail) {
    const cleanEmail = rawEmail.toString().trim().toLowerCase();
    if (validateEmail(cleanEmail)) {
      extracted.email = cleanEmail;
      extracted.email_valid = true;
    } else {
      console.warn(`Invalid email format: ${rawEmail}`);
      extracted.email_valid = false;
    }
  } else {
    console.warn('No email found in Paperform data');
    extracted.email_valid = false;
  }
  
  // Handle submission ID
  extracted.submission_id = paperformData.submission_id || 
                           paperformData.id || 
                           `sub_${Date.now()}`;
  
  // Handle amount from score field (primary) or fallback methods
  if (!extracted.amount && paperformData.score) {
    extracted.amount = paperformData.score;
  }
  
  // Ensure numeric amount
  if (extracted.amount) {
    extracted.amount = parseFloat(extracted.amount);
  }
  
  // Generate display name for invoice
  if (extracted.first_name && extracted.last_name) {
    extracted.display_name = `${extracted.first_name} ${extracted.last_name}`;
  } else if (extracted.name) {
    extracted.display_name = extracted.name;
  } else {
    extracted.display_name = extracted.email || 'Registration Participant';
  }
  
  return extracted;
}

// Export functions
module.exports = {
  fieldMapping,
  extractFields,
  extractField,
  validateEmail
};
