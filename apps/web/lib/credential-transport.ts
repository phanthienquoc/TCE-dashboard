type CredentialEnvelope = {
  v: 1;
  alg: 'RSA-OAEP-256+A256GCM';
  key: string;
  iv: string;
  tag: string;
  data: string;
};

const PUBLIC_KEY = process.env.NEXT_PUBLIC_TCE_CREDENTIAL_PUBLIC_KEY;

function toBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptCredentialPayload(value: unknown): Promise<CredentialEnvelope> {
  if (!PUBLIC_KEY) throw new Error('NEXT_PUBLIC_TCE_CREDENTIAL_PUBLIC_KEY is required');
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(PUBLIC_KEY),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aes));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plaintext)
  );
  const tag = encrypted.slice(encrypted.length - 16);
  const data = encrypted.slice(0, encrypted.length - 16);
  const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, rawAes);
  return {
    v: 1,
    alg: 'RSA-OAEP-256+A256GCM',
    key: toBase64Url(wrappedKey),
    iv: toBase64Url(iv),
    tag: toBase64Url(tag),
    data: toBase64Url(data),
  };
}
