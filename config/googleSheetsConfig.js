const fs = require('fs');
const path = require('path');

// Load environment variables if not already loaded (e.g. via dotenv)
// We assume GOOGLE_SHEETS_CREDENTIALS is set in process.env
const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS;

if (!credentialsPath) {
  throw new Error("GOOGLE_SHEETS_CREDENTIALS is not set in .env");
}

const absolutePath = path.resolve(credentialsPath);

if (!fs.existsSync(absolutePath)) {
  throw new Error("Google Sheets credentials file not found at " + absolutePath);
}

const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

// Basic Validation
if (!credentials.client_email || !credentials.private_key) {
  throw new Error("Invalid Google Sheets credentials: client_email and private_key are required.");
}

module.exports = credentials;
