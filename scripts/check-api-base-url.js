const fs = require('fs');
const path = require('path');

const EXPECTED = 'https://movenorth.vercel.app';

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'lib', 'apiBaseUrl.ts');

if (!fs.existsSync(filePath)) {
  console.error('Error: file not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Find the first uncommented line that defines API_BASE_URL
const lines = content.split(/\r?\n/);
let value = null;
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  // skip single-line comments
  if (trimmed.startsWith('//')) continue;
  const m = line.match(/export\s+const\s+API_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
  if (m) { value = m[1].trim(); break; }
}
if (!value) {
  console.error('Error: API_BASE_URL not found in', filePath);
  process.exit(1);
}
if (value !== EXPECTED) {
  console.error('\n✖ Pre-commit check failed: API_BASE_URL is not the production URL.');
  console.error('  Found:   ' + value);
  console.error('  Expected:' + EXPECTED + '\n');
  console.error('If you need to use a non-prod URL for local testing, consider using environment variables or a separate config file that is not committed.');
  process.exit(1);
}

console.log('✔ API_BASE_URL is the expected production URL.');
process.exit(0);
