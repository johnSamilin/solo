import { Client } from 'acme-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAIN = process.env.DOMAIN;
const EMAIL = process.env.EMAIL;
const PRODUCTION = process.env.NODE_ENV === 'production';

if (!DOMAIN || !EMAIL) {
  console.error('Please set DOMAIN and EMAIL environment variables');
  process.exit(1);
}

const certsDir = path.join(__dirname, '../certs');
const accountKeyPath = path.join(certsDir, 'account.key');
const domainKeyPath = path.join(certsDir, 'domain.key');
const certPath = path.join(certsDir, 'cert.pem');

async function renewCertificate() {
  try {
    // Check if certificate exists
    if (!fs.existsSync(certPath)) {
      console.error('Certificate not found. Please run init-certs.js first');
      process.exit(1);
    }

    // Read existing keys
    const accountKey = fs.readFileSync(accountKeyPath);
    const domainKey = fs.readFileSync(domainKeyPath);

    // Create ACME client with existing account key
    const client = new Client({
      directoryUrl: PRODUCTION
        ? Client.directory.letsencrypt.production
        : Client.directory.letsencrypt.staging,
      accountKey
    });

    // Create CSR using existing domain key
    const [key, csr] = await Client.createCsr({
      commonName: DOMAIN,
      altNames: [`www.${DOMAIN}`]
    });

    // Get new certificate
    const cert = await client.auto({
      csr,
      email: EMAIL,
      termsOfServiceAgreed: true,
      challengePriority: ['http-01'],
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        // Implement HTTP challenge
        console.log('Challenge created:', {
          token: challenge.token,
          keyAuthorization
        });
      },
      challengeRemoveFn: async (authz, challenge) => {
        // Clean up challenge files
        console.log('Challenge removed:', challenge.token);
      },
    });

    // Backup existing certificate
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(certsDir, `cert.${timestamp}.pem.bak`);
    fs.copyFileSync(certPath, backupPath);

    // Save new certificate
    fs.writeFileSync(certPath, cert);

    console.log('Certificate renewed successfully!');
    console.log('New certificate path:', certPath);
    console.log('Backup created at:', backupPath);

  } catch (error) {
    console.error('Error renewing certificate:', error);
    process.exit(1);
  }
}

renewCertificate();