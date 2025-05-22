import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirp } from 'mkdirp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Joplin database path based on platform
function getDefaultJoplinPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, '../../.config/joplin-desktop');
  } else if (process.platform === 'darwin') {
    return path.join(process.env.HOME, 'Library', 'Application Support', 'joplin-desktop');
  }
  return path.join(process.env.HOME, '.config', 'joplin-desktop');
}

// List available profiles
function listProfiles(basePath) {
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    const profiles = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    if (profiles.length === 0) {
      throw new Error('No profiles found');
    }

    console.log('\nAvailable profiles:');
    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile}`);
    });

    return profiles;
  } catch (error) {
    throw new Error(`Failed to read profiles: ${error.message}`);
  }
}

// Find the most recent database file in a profile
function findJoplinDatabase(profilePath) {
  const files = fs.readdirSync(profilePath);
  const dbFiles = files.filter(file => file.endsWith('.sqlite'));
  if (dbFiles.length === 0) {
    throw new Error('No Joplin database found');
  }
  return path.join(profilePath, dbFiles[0]);
}

// Get folder path for a note
async function getNotePath(db, noteId, outputBase) {
  return new Promise((resolve, reject) => {
    const paths = [];
    let currentId = noteId;

    function getFolder(id) {
      return new Promise((innerResolve, innerReject) => {
        db.get(
          'SELECT title, parent_id FROM folders WHERE id = ?',
          [id],
          (err, row) => {
            if (err) innerReject(err);
            else innerResolve(row);
          }
        );
      });
    }

    function getNote(id) {
      return new Promise((innerResolve, innerReject) => {
        db.get(
          'SELECT title, parent_id FROM notes WHERE id = ?',
          [id],
          (err, row) => {
            if (err) innerReject(err);
            else innerResolve(row);
          }
        );
      });
    }

    async function buildPath() {
      try {
        const note = await getNote(noteId);
        paths.unshift(note.title);
        currentId = note.parent_id;

        while (currentId) {
          const folder = await getFolder(currentId);
          if (!folder) break;
          paths.unshift(folder.title);
          currentId = folder.parent_id;
        }

        const fullPath = path.join(outputBase, ...paths);
        resolve(fullPath);
      } catch (error) {
        reject(error);
      }
    }

    buildPath();
  });
}

// Extract images from notes
async function extractImages(dbPath, outputPath) {
  const db = new sqlite3.Database(dbPath);
  const resourcesDir = path.join(path.dirname(dbPath), 'resources');

  // Create output directory
  await mkdirp(outputPath);

  // Get all resources that are images
  const resources = await new Promise((resolve, reject) => {
    db.all(
      `SELECT r.id, r.mime, r.title, r.filename, n.id as note_id 
       FROM resources r 
       JOIN note_resources nr ON r.id = nr.resource_id 
       JOIN notes n ON nr.note_id = n.id 
       WHERE r.mime LIKE 'image/%'`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  // Process each resource
  for (const resource of resources) {
    try {
      // Get note path
      const notePath = await getNotePath(db, resource.note_id, outputPath);
      await mkdirp(notePath);

      // Determine resource file path
      const resourcePath = path.join(resourcesDir, `${resource.id}.${resource.title.split('/')[1]}`);
      if (!fs.existsSync(resourcePath)) {
        console.warn(`Resource file not found: ${resourcePath}`);
        continue;
      }

      // Copy image to note directory
      const outputFile = path.join(notePath, resource.filename || `${resource.id}.${resource.mime.split('/')[1]}`);
      fs.copyFileSync(resourcePath, outputFile);
      console.log(`Copied ${resource.filename || resource.id} to ${notePath}`);
    } catch (error) {
      console.error(`Failed to process resource ${resource.id}:`, error);
    }
  }

  db.close();
}

// Main execution
async function main() {
  try {
    const joplinPath = getDefaultJoplinPath();
    console.log('Joplin config directory:', joplinPath);

    // List available profiles and get user selection
    const profiles = listProfiles(joplinPath);
    const profileIndex = parseInt(process.argv[2], 10) - 1;

    if (isNaN(profileIndex) || profileIndex < 0 || profileIndex >= profiles.length) {
      console.error('\nUsage: npm run extract-joplin-images <profile-number>');
      console.error('Please select a profile number from the list above.');
      process.exit(1);
    }

    const selectedProfile = profiles[profileIndex];
    const profilePath = path.join(joplinPath, selectedProfile);
    const dbPath = findJoplinDatabase(profilePath);
    const outputPath = path.join(__dirname, '..', 'joplin-images');

    console.log('\nSelected profile:', selectedProfile);
    console.log('Database path:', dbPath);
    console.log('Output directory:', outputPath);

    await extractImages(dbPath, outputPath);
    console.log('\nImage extraction complete!');
  } catch (error) {
    console.error('Failed to extract images:', error);
    process.exit(1);
  }
}

main();