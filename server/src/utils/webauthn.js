const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_NAME = 'Vaultix';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = (process.env.WEBAUTHN_ORIGIN || `https://${RP_ID}`)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function getRpConfig() {
  return { id: RP_ID, name: RP_NAME };
}

async function generateRegistrationOpts(user, existingCredentials = []) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(user.id, 'utf-8'),
    userName: user.email,
    userDisplayName: user.fullName,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  return options;
}

async function verifyRegistrationOpts(response, expectedChallenge, user) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  return verification;
}

async function generateAuthenticationOpts(existingCredentials = []) {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    })),
    userVerification: 'preferred',
  });

  return options;
}

async function verifyAuthenticationOpts(response, expectedChallenge, credential) {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(
        typeof credential.publicKey === 'string'
          ? credential.publicKey
          : JSON.stringify(credential.publicKey)
      ),
      counter: Number(credential.counter),
    },
  });

  return verification;
}

module.exports = {
  getRpConfig,
  generateRegistrationOpts,
  verifyRegistrationOpts,
  generateAuthenticationOpts,
  verifyAuthenticationOpts,
};
