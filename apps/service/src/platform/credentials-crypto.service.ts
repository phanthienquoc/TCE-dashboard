import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

@Injectable()
export class CredentialsCryptoService {
  private key(): Buffer {
    const raw = process.env.TCE_CREDENTIAL_ENCRYPTION_KEY;
    if (!raw) throw new Error('TCE_CREDENTIAL_ENCRYPTION_KEY is required');
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) throw new Error('TCE_CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters');
    return key;
  }

  encrypt(value: Record<string, unknown>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(payload: string): Record<string, unknown> {
    const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
    if (version !== VERSION || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted credentials');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8'));
  }
}
