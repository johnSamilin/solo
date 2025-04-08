import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = join(__dirname, '..', 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

// Generate self-signed certificate for development
try {
  console.log('Generating development certificates...');

  // Generate private key
  execSync(`openssl genrsa -out ${join(CERTS_DIR, 'server.key')} 2048`);

  // Generate CSR configuration
  const csrConf = `[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn
[dn]
C = US
ST = Development State
L = Development City
O = Development Organization
OU = Development Unit
CN = localhost
[req_ext]
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1`;

  const csrConfPath = join(CERTS_DIR, 'csr.conf');
  fs.writeFileSync(csrConfPath, csrConf);

  // Generate certificate
  execSync(`openssl req -new -x509 -nodes -sha256 -days 365 \\
    -key ${join(CERTS_DIR, 'server.key')} \\
    -out ${join(CERTS_DIR, 'server.crt')} \\
    -config ${csrConfPath}`);

  // Clean up CSR config
  fs.unlinkSync(csrConfPath);

  console.log('Development certificates generated successfully!');
  console.log('Location:', CERTS_DIR);
} catch (error) {
  console.error('Error generating certificates:', error);
  process.exit(1);
}