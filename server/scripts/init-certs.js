import acme from 'acme-client';
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

async function createCertificate() {
  try {
    // Ensure certs directory exists
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    // Create a new ACME client
    const client = new acme.Client({
      directoryUrl: PRODUCTION
        ? acme.directory.letsencrypt.production
        : acme.directory.letsencrypt.staging,
      accountKey: await acme.forge.createPrivateKey()
    });

    // Create an account
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${EMAIL}`]
    });

    // Save account key
    fs.writeFileSync(accountKeyPath, client.accountKey);

    // Create domain key pair
    const domainKey = await acme.forge.createPrivateKey();
    fs.writeFileSync(domainKeyPath, domainKey);

    // Create CSR
    const [key, csr] = await acme.forge.createCsr({
      commonName: DOMAIN,
      altNames: [`www.${DOMAIN}`]
    });

    // Get certificate
    const cert = await client.auto({
      csr,
      email: EMAIL,
      termsOfServiceAgreed: true,
      challengePriority: ['http-01'],
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        // This is where you need to implement HTTP challenge
        // You should make keyAuthorization available at:
        // http://<DOMAIN>/.well-known/acme-challenge/<challenge.token>
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

    // Save certificate
    fs.writeFileSync(certPath, cert);

    console.log('Certificate created successfully!');
    console.log('Certificate path:', certPath);
    console.log('Domain key path:', domainKeyPath);

  } catch (error) {
    console.error('Error creating certificate:', error);
    process.exit(1);
  }
}

createCertificate();