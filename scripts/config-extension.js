import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Get env filename argument (defaults to '.env')
const envArg = process.argv[2] || '.env';
const envPath = path.resolve(rootDir, 'backend', envArg);

console.log(`Loading environment from: ${envPath}`);

if (!fs.existsSync(envPath)) {
  console.error(`Error: Env file not found at ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) return;
  const match = cleanLine.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

// Determine API URL and Frontend URL from env, falling back to defaults if not defined
let apiUrl = envVars.EXTENSION_API_URL;
let frontendUrl = envVars.EXTENSION_FRONTEND_URL;

if (!apiUrl || !frontendUrl) {
  if (envArg.includes('production')) {
    apiUrl = apiUrl || 'https://jobapplyai.owera.ca';
    frontendUrl = frontendUrl || 'https://jobapplyai.owera.ca';
  } else {
    apiUrl = apiUrl || 'http://localhost:8000';
    frontendUrl = frontendUrl || 'http://localhost:5173';
  }
}

console.log(`Target configuration:`);
console.log(`  API URL: ${apiUrl}`);
console.log(`  Frontend URL: ${frontendUrl}`);

const extDir = path.resolve(rootDir, 'browser-extension');

// Helper to replace text in file
const updateFile = (filePath, regex, replacement) => {
  const absolutePath = path.resolve(extDir, filePath);
  if (fs.existsSync(absolutePath)) {
    let content = fs.readFileSync(absolutePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(absolutePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
};

// 1. Update background.js
updateFile(
  'background.js',
  /chrome\.storage\.local\.set\(\{\s*apiUrl:\s*"[^"]*"\s*\}/g,
  `chrome.storage.local.set({ apiUrl: "${apiUrl}" }`
);
updateFile(
  'background.js',
  /Default backend API URL set to [^"\s]*/g,
  `Default backend API URL set to ${apiUrl}`
);

// 2. Update popup.js
updateFile(
  'popup.js',
  /const DEFAULT_API_URL\s*=\s*"[^"]*";/g,
  `const DEFAULT_API_URL = "${apiUrl}";`
);
updateFile(
  'popup.js',
  /const DEFAULT_FRONTEND_URL\s*=\s*"[^"]*";/g,
  `const DEFAULT_FRONTEND_URL = "${frontendUrl}";`
);

// 3. Update common/constants.js
updateFile(
  'common/constants.js',
  /window\.API_DEFAULT_URL\s*=\s*"[^"]*";/g,
  `window.API_DEFAULT_URL = "${apiUrl}";`
);

console.log('Extension configuration updated successfully!');
