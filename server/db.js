import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { mkdirp } from 'mkdirp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data/solo.db');
const DATA_DIR = path.join(__dirname, 'data');
export const USER_DATA_DIR = path.join(DATA_DIR, 'users');
const MAX_DATA_FILES = 10;

// Ensure directories exist
await mkdirp(DATA_DIR);
await mkdirp(USER_DATA_DIR);

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Prepare statements
const createUser = db.prepare(`
  INSERT INTO users (id, username, password)
  VALUES (?, ?, ?)
`);

const getUser = db.prepare(`
  SELECT * FROM users WHERE username = ?
`);

const createSession = db.prepare(`
  INSERT INTO sessions (id, user_id, token, expires_at)
  VALUES (?, ?, ?, ?)
`);

const getSession = db.prepare(`
  SELECT * FROM sessions 
  WHERE token = ? AND expires_at > CURRENT_TIMESTAMP
`);

const deleteExpiredSessions = db.prepare(`
  DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP
`);

// Helper functions
export function getUserByUsername(username) {
  return getUser.get(username);
}

export function createNewUser(id, username, hashedPassword) {
  createUser.run(id, username, hashedPassword);
  
  // Create user data directory and images subdirectory
  const userDir = path.join(USER_DATA_DIR, id);
  const imagesDir = path.join(userDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
}

export function createUserSession(sessionId, userId, token, expiresAt) {
  // Clean up expired sessions first
  deleteExpiredSessions.run();
  
  // Create new session
  createSession.run(sessionId, userId, token, expiresAt.toString());
}

export function validateSession(token) {
  // Clean up expired sessions first
  deleteExpiredSessions.run();
  
  // Get valid session
  return getSession.get(token);
}

function getDataFiles(userId) {
  const userDir = path.join(USER_DATA_DIR, userId);
  if (!fs.existsSync(userDir)) return [];

  return fs.readdirSync(userDir)
    .filter(file => file.startsWith('data-') && file.endsWith('.json'))
    .sort((a, b) => {
      const timeA = new Date(a.slice(5, -5)).getTime();
      const timeB = new Date(b.slice(5, -5)).getTime();
      return timeB - timeA; // Sort in descending order (newest first)
    });
}

function rotateDataFiles(userId) {
  const files = getDataFiles(userId);
  const userDir = path.join(USER_DATA_DIR, userId);

  // Remove oldest files if we exceed MAX_DATA_FILES
  if (files.length >= MAX_DATA_FILES) {
    files.slice(1, MAX_DATA_FILES + 1).forEach(file => {
      fs.unlinkSync(path.join(userDir, file));
    });
  }
}

export function getUserData(userId) {
  const files = getDataFiles(userId);
  if (files.length === 0) return null;
  
  // Get the latest file
  const latestFile = files.pop();
  const filePath = path.join(USER_DATA_DIR, userId, latestFile);

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading user data:', error);
    return null;
  }
}

export function saveUserData(userId, data) {
  const userDir = path.join(USER_DATA_DIR, userId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `data-${timestamp}.json`;
  const filePath = path.join(userDir, filename);
  
  try {
    // Ensure user directory exists
    fs.mkdirSync(userDir, { recursive: true });
    
    // Save data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    // Rotate files if needed
    rotateDataFiles(userId);
    
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
}

export async function saveUserImage(userId, imageId, imageData) {
  const userImagesDir = path.join(USER_DATA_DIR, userId, 'images');
  const imagePath = path.join(userImagesDir, imageId);
  
  try {
    // Ensure images directory exists
    await mkdirp(userImagesDir);
    
    // Save image
    await fs.promises.writeFile(imagePath, imageData);
    return true;
  } catch (error) {
    console.error('Error saving image:', error);
    return false;
  }
}