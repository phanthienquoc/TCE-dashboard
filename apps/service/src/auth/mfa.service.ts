import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

@Injectable()
export class MfaService {
  generateSecret(): string {
    return randomBytes(20).toString('base64url');
  }
  generateRecoveryCode(): string {
    return randomBytes(8).toString('hex');
  }
  verifyTotp(secret: string, code: string, step = Math.floor(Date.now() / 30000)): boolean {
    for (const offset of [-1, 0, 1]) {
      const counter = Buffer.alloc(8);
      counter.writeBigInt64BE(BigInt(step + offset));
      const digest = createHmac('sha1', Buffer.from(secret, 'base64url')).update(counter).digest();
      const index = digest[digest.length - 1] & 15;
      const value =
        ((digest[index] & 127) << 24) |
        (digest[index + 1] << 16) |
        (digest[index + 2] << 8) |
        digest[index + 3];
      if (String(value % 1000000).padStart(6, '0') === code) return true;
    }
    return false;
  }
}
