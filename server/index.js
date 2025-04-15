import fs from 'fs';
import _path from 'path';
import { fileURLToPath } from 'url';
import http2 from 'http2';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  getUserByUsername,
  createNewUser,
  createUserSession,
  validateSession,
  getUserData,
  saveUserData,
  saveUserImage,
  USER_DATA_DIR
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = _path.dirname(__filename);

// Configuration
const HTTP_PORT = process.env.HTTP_PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const STATIC_DIR = _path.join(__dirname, '../dist');

// ACME challenge storage
const ACME_CHALLENGES = new Map();

// Load SSL certificates
const serverOptions = {
  key: fs.readFileSync(_path.join(__dirname, 'certs/server.key')),
  cert: fs.readFileSync(_path.join(__dirname, 'certs/server.crt')),
  allowHTTP1: true
};

// Create HTTP server for ACME challenges
const httpServer = http.createServer((req, res) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle ACME challenge requests
  if (req.url?.startsWith('/.well-known/acme-challenge/')) {
    const token = req.url.split('/').pop();
    const keyAuthorization = ACME_CHALLENGES.get(token);

    if (keyAuthorization) {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        ...corsHeaders
      });
      res.end(keyAuthorization);
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end('Challenge not found');
    return;
  }

  // Redirect all other HTTP traffic to HTTPS
  const host = req.headers.host?.split(':')[0] || 'localhost';
  res.writeHead(301, {
    'Location': `https://${host}${req.url}`,
    ...corsHeaders
  });
  res.end();
});

// Create HTTP/2 server
const http2Server = http2.createSecureServer(serverOptions);

// Middleware to verify JWT token
const verifyToken = (headers) => {
  const token = headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    const session = validateSession(token);
    return session;
  } catch (err) {
    return null;
  }
};

// Parse multipart form data
const parseMultipartFormData = (data) => {
  // Convert buffer to string
  const content = data.toString();

  // Get boundary from content
  const boundaryMatch = content.match(/^--([^\r\n]+)/);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1];

  // Split content by boundary
  const parts = content.split('--' + boundary);

  // Process each part
  for (const part of parts) {
    // Skip empty parts and final boundary
    if (!part.trim() || part.trim() === '--') continue;

    // Check if this part contains file data
    if (part.includes('Content-Disposition: form-data; name="image"')) {
      // Find the start of file content (after double newline)
      const contentStart = part.indexOf('\r\n\r\n');
      if (contentStart === -1) continue;

      // Get content type
      const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
      const contentType = contentTypeMatch ? contentTypeMatch[1] : null;

      // Extract file content
      const fileContent = data.slice(
        data.indexOf(Buffer.from('\r\n\r\n')) + 4,
        data.lastIndexOf(Buffer.from('\r\n--' + boundary))
      );

      return {
        contentType,
        data: fileContent
      };
    }
  }

  return null;
};

// Handle HTTP/2 requests
http2Server.on('stream', async (stream, headers) => {
  const method = headers[':method'];
  const path = headers[':path'];

  // CORS headers
  const responseHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'content-type': 'application/json; charset=utf-8'
  };

  // Handle ACME challenge requests (as backup)
  if (path.startsWith('/.well-known/acme-challenge/')) {
    const token = path.split('/').pop();
    const keyAuthorization = ACME_CHALLENGES.get(token);

    if (keyAuthorization) {
      stream.respond({
        ':status': 200,
        'content-type': 'text/plain; charset=utf-8',
        ...responseHeaders
      });
      stream.end(keyAuthorization);
      return;
    }

    stream.respond({ ':status': 404, ...responseHeaders });
    stream.end('Challenge not found');
    return;
  }

  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    stream.respond({
      ':status': 200,
      ...responseHeaders
    });
    stream.end();
    return;
  }

  // Authentication endpoints
  if (path === '/api/register' && method === 'POST') {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => data += chunk);
    stream.on('end', async () => {
      try {
        const { username, password } = JSON.parse(data);
        
        // Check if user exists
        const existingUser = getUserByUsername(username);
        if (existingUser) {
          stream.respond({ ':status': 400, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Username already exists' }));
          return;
        }

        // Create new user
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);
        createNewUser(userId, username, hashedPassword);

        stream.respond({ ':status': 201, ...responseHeaders });
        stream.end(JSON.stringify({ message: 'User registered successfully' }));
      } catch (error) {
        console.error('Registration error:', error);
        stream.respond({ ':status': 500, ...responseHeaders });
        stream.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  if (path === '/api/login' && method === 'POST') {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => data += chunk);
    stream.on('end', async () => {
      try {
        const { username, password } = JSON.parse(data);
        const user = getUserByUsername(username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
          stream.respond({ ':status': 401, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Invalid credentials' }));
          return;
        }

        // Create session
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        createUserSession(sessionId, user.id, token, expiresAt);

        stream.respond({ ':status': 200, ...responseHeaders });
        stream.end(JSON.stringify({ token }));
      } catch (error) {
        console.error('Login error:', error);
        stream.respond({ ':status': 500, ...responseHeaders });
        stream.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  // Protected data endpoints
  if (path.startsWith('/api/data')) {
    const session = verifyToken(headers);
    if (!session) {
      stream.respond({ ':status': 401, ...responseHeaders });
      stream.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Handle data synchronization
    if (method === 'POST') {
      let data = '';
      let hasEnded = false;
      
      stream.setEncoding('utf8');
      stream.on('data', chunk => {
        if (!hasEnded) {
          data += chunk;
        }
      });
      
      stream.on('end', () => {
        if (hasEnded) return;
        hasEnded = true;
        
        try {
          const syncData = JSON.parse(data);
          const success = saveUserData(session.user_id, syncData);
          
          if (success) {
            stream.respond({ ':status': 200, ...responseHeaders });
            stream.end(JSON.stringify({ message: 'Data synchronized successfully' }));
          } else {
            stream.respond({ ':status': 500, ...responseHeaders });
            stream.end(JSON.stringify({ error: 'Failed to save data' }));
          }
        } catch (error) {
          console.error('Sync error:', error);
          if (!hasEnded) {
            stream.respond({ ':status': 500, ...responseHeaders });
            stream.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      });

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!hasEnded) {
          hasEnded = true;
          stream.respond({ ':status': 500, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Stream error occurred' }));
        }
      });
      
      return;
    }

    if (method === 'GET') {
      const userData = getUserData(session.user_id);
      stream.respond({ ':status': 200, ...responseHeaders });
      stream.end(JSON.stringify(userData || {}));
      return;
    }
  }

  // Handle image upload
  if (path === '/api/upload' && method === 'POST') {
    const session = verifyToken(headers);
    if (!session) {
      stream.respond({ ':status': 401, ...responseHeaders });
      stream.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let data = Buffer.from([]);
    let hasEnded = false;

    stream.on('data', chunk => {
      if (!hasEnded) {
        data = Buffer.concat([data, chunk]);
      }
    });

    stream.on('end', async () => {
      if (hasEnded) return;
      hasEnded = true;

      try {
        const parsedData = parseMultipartFormData(data);
        if (!parsedData) {
          stream.respond({ ':status': 400, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Invalid form data' }));
          return;
        }

        const { contentType, data: imageData } = parsedData;
        const extension = contentType.split('/')[1] || 'png';
        const imageId = `${uuidv4()}.${extension}`;
        
        const success = await saveUserImage(session.user_id, imageId, imageData);
        
        if (success) {
          stream.respond({ 
            ':status': 200,
            ...responseHeaders,
          });
          stream.end(JSON.stringify({ 
            url: `/api/images/${session.user_id}/${imageId}` 
          }));
        } else {
          stream.respond({ ':status': 500, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Failed to save image' }));
        }
      } catch (error) {
        console.error('Image upload error:', error);
        if (!hasEnded) {
          stream.respond({ ':status': 500, ...responseHeaders });
          stream.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!hasEnded) {
        hasEnded = true;
        stream.respond({ ':status': 500, ...responseHeaders });
        stream.end(JSON.stringify({ error: 'Stream error occurred' }));
      }
    });

    return;
  }

  // Handle image retrieval
  if (path.startsWith('/api/images/') && method === 'GET') {
    const [, , , userId, imageId] = path.split('/');
    try {
      const imagePath = _path.join(USER_DATA_DIR, userId, 'images', imageId);
      if (!fs.existsSync(imagePath)) {
        stream.respond({ ':status': 404, ...responseHeaders });
        stream.end('Image not found');
        return;
      }

      const stat = await fs.promises.stat(imagePath);
      const contentType = 'image/' + _path.extname(imageId).slice(1);
      
      stream.respondWithFile(imagePath, {
        'content-type': contentType,
        'content-length': stat.size,
        ...responseHeaders
      });
    } catch (error) {
      console.error('Image retrieval error:', error);
      stream.respond({ ':status': 500, ...responseHeaders });
      stream.end('Internal server error');
    }
    return;
  }

  // Serve static files
  if (method === 'GET') {
    try {
      const filePath = path === '/' ? 
        _path.join(STATIC_DIR, 'index.html') : 
        _path.join(STATIC_DIR, path);

      if (!filePath.startsWith(STATIC_DIR)) {
        stream.respond({ ':status': 403, ...responseHeaders });
        stream.end('Forbidden');
        return;
      }

      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) {
        const contentType = getContentType(filePath);
        stream.respondWithFile(filePath, {
          ...responseHeaders,
          'content-length': stat.size,
          'content-type': `${contentType}; charset=utf-8`,
        });
      } else {
        stream.respond({ ':status': 404, ...responseHeaders });
        stream.end('Not found');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        stream.respond({ ':status': 404, ...responseHeaders });
        stream.end('Not found');
      } else {
        console.error(error);
        stream.respond({ ':status': 500, ...responseHeaders });
        stream.end('Internal server error');
      }
    }
    return;
  }

  // Handle unknown routes
  stream.respond({ ':status': 404, ...responseHeaders });
  stream.end('Not found');
});

// Helper function to determine content type
function getContentType(filePath) {
  const ext = _path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  return types[ext] || 'application/octet-stream';
}

// Export functions for ACME challenge management
export function setAcmeChallenge(token, keyAuthorization) {
  ACME_CHALLENGES.set(token, keyAuthorization);
}

export function removeAcmeChallenge(token) {
  ACME_CHALLENGES.delete(token);
}

// Start servers
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on port ${HTTP_PORT}`);
});

http2Server.listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running on port ${HTTPS_PORT}`);
});

// Handle server errors
httpServer.on('error', (err) => {
  console.error('HTTP server error:', err);
});

http2Server.on('error', (err) => {
  console.error('HTTPS server error:', err);
});