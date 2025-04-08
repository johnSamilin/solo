# HTTP/2 Server for Solo

This is a secure HTTP/2 server implementation for Solo that handles authentication and data synchronization.

## Features

- HTTP/2 support with fallback to HTTP/1.1
- JWT-based authentication
- Secure password hashing with bcrypt
- Data synchronization endpoints
- Static file serving
- CORS support
- Let's Encrypt certificate management

## Setup

### Development Certificates

For local development, generate self-signed certificates:

```bash
mkdir certs
cd certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
  -keyout server.key -out server.crt
```

### Production Certificates

For production, use Let's Encrypt certificates:

1. Set required environment variables:
```bash
export DOMAIN=yourdomain.com
export EMAIL=your@email.com
export NODE_ENV=production
```

2. Initialize certificates:
```bash
npm run certs:init
```

3. Set up automatic renewal:
```bash
# Add to crontab (runs daily at 3am)
0 3 * * * cd /path/to/project && npm run certs:renew
```

### Server Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run server
```

For development with auto-reload:
```bash
npm run server:dev
```

## API Endpoints

### Authentication

- `POST /api/register`
  - Register a new user
  - Body: `{ username: string, password: string }`

- `POST /api/login`
  - Login and receive JWT token
  - Body: `{ username: string, password: string }`

### Data Synchronization

- `GET /api/data`
  - Get user's synchronized data
  - Requires Authorization header with JWT token

- `POST /api/data`
  - Update user's synchronized data
  - Requires Authorization header with JWT token
  - Body: User's data object

## Security Notes

- Replace the default JWT secret in production
- Consider using a proper database instead of in-memory storage
- Keep SSL certificates secure and up to date
- Implement rate limiting for production use
- Ensure proper DNS configuration for Let's Encrypt validation
- Set up firewall rules to allow HTTP/HTTPS traffic