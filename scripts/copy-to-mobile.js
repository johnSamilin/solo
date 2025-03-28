import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '..', 'dist');
const targetDir = path.join(__dirname, '..', 'mobile-app', 'assets', 'webapp');

// Ensure the target directory exists
fs.ensureDirSync(targetDir);

// Copy the built files
fs.copySync(sourceDir, targetDir, { overwrite: true });

console.log('Web app files copied to mobile app assets successfully!');