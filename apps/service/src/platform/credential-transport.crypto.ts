import {
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  constants,
} from 'node:crypto';

const PUBLIC_ENV = 'TCE_CREDENTIAL_PUBLIC_KEY';
const PRIVATE_ENV = 'TCE_CREDENTIAL_PRIVATE_KEY';
export type CredentialEnvelope = {
  v: 1;
  alg: 'RSA-OAEP-256+A256GCM';
  key: string;
  iv: string;
  tag: string;
  data: string;
};

function envKey(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\\n/g, '\n');
}

export function encryptCredentialPayload(value: unknown): CredentialEnvelope {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const wrappedKey = publicEncrypt(
    {
      key: createPublicKey(envKey(PUBLIC_ENV)),
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    aesKey
  );
  return {
    v: 1,
    alg: 'RSA-OAEP-256+A256GCM',
    key: wrappedKey.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: data.toString('base64url'),
  };
}

export function decryptCredentialPayload(envelope: CredentialEnvelope): Record<string, unknown> {
  if (!envelope || envelope.v !== 1 || envelope.alg !== 'RSA-OAEP-256+A256GCM')
    throw new Error('Invalid credential envelope');
  const aesKey = privateDecrypt(
    {
      key: createPrivateKey(envKey(PRIVATE_ENV)),
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(envelope.key, 'base64url')
  );
  const decipher = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(envelope.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  ) as Record<string, unknown>;
}
