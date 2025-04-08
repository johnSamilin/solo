import Database from 'better-sqlite3';
import _path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { mkdirp } from 'mkdirp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = _path.dirname(__filename);

const DB_PATH = _path.join(__dirname, 'data/solo.db');
export const DATA_DIR = _path.join(__dirname, 'data');
export const USER_DATA_DIR = _path.join(DATA_DIR, 'users');

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
  const userDir = _path.join(USER_DATA_DIR, id);
  const imagesDir = _path.join(userDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
}

export function createUserSession(sessionId, userId, token, expiresAt) {
  // Clean up expired sessions first
  deleteExpiredSessions.run();
  
  // Create new session
  createSession.run(sessionId, userId, token, expiresAt);
}

export function validateSession(token) {
  // Clean up expired sessions first
  deleteExpiredSessions.run();
  
  // Get valid session
  return getSession.get(token);
}

export function getUserData(userId) {
  const userDataPath = _path.join(USER_DATA_DIR, userId, 'data.json');
  try {
    if (fs.existsSync(userDataPath)) {
      const data = fs.readFileSync(userDataPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading user data:', error);
  }
  return null;
}

export function saveUserData(userId, data) {
  const userDir = _path.join(USER_DATA_DIR, userId);
  const userDataPath = _path.join(userDir, 'data.json');
  
  try {
    // Ensure user directory exists
    fs.mkdirSync(userDir, { recursive: true });
    
    // Save data
    fs.writeFileSync(userDataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
}

export async function saveUserImage(userId, imageId, imageData) {
  const userImagesDir = _path.join(USER_DATA_DIR, userId, 'images');
  const imagePath = _path.join(userImagesDir, imageId);
  
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