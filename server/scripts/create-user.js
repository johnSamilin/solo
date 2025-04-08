import readline from 'readline';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createNewUser, getUserByUsername } from '../db.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createUser() {
  try {
    console.log('\nCreate Initial User\n');

    // Get username
    let username;
    while (true) {
      username = await question('Enter username: ');
      if (!username.trim()) {
        console.log('Username cannot be empty!');
        continue;
      }

      // Check if username exists
      const existingUser = getUserByUsername(username);
      if (existingUser) {
        console.log('Username already exists!');
        continue;
      }
      break;
    }

    // Get password
    let password;
    while (true) {
      password = await question('Enter password (min 8 characters): ');
      if (password.length < 8) {
        console.log('Password must be at least 8 characters long!');
        continue;
      }

      const confirmPassword = await question('Confirm password: ');
      if (password !== confirmPassword) {
        console.log('Passwords do not match!');
        continue;
      }
      break;
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    createNewUser(userId, username, hashedPassword);
    
    console.log('\nUser created successfully!');
    console.log('Username:', username);
    console.log('User ID:', userId);

  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    rl.close();
  }
}

createUser();