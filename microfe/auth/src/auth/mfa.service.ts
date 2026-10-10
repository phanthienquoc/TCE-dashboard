import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class MfaService {
  generateChallenge(userId: string): string {
    const secret = this.secret();
    const payload = Buffer.from(JSON.stringify({ sub: userId, typ: 'mfa-challenge', exp: Math.floor(Date.now() / 1000) + 300, jti: randomBytes(16).toString('base64url') })).toString('base64url');
    return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
  }
  verifyChallenge(token: string): string | null {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; typ?: string; exp?: number };
      if (!claims.sub || claims.typ !== 'mfa-challenge' || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
      return claims.sub;
    } catch { return null; }
  }
  generateSecret(): string { return randomBytes(20).toString('base64url'); }
  verifyTotp(secret: string, code: string, step = Math.floor(Date.now() / 30000)): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const key = Buffer.from(secret, 'base64url');
    for (const offset of [-1, 0, 1]) {
      const counter = Buffer.alloc(8);
      counter.writeBigInt64BE(BigInt(step + offset));
      const digest = createHmac('sha1', key).update(counter).digest();
      const index = digest[digest.length - 1] & 15;
      const value = ((digest[index] & 127) << 24) | (digest[index + 1] << 16) | (digest[index + 2] << 8) | digest[index + 3];
      const candidate = Buffer.from(String(value % 1000000).padStart(6, '0'));
      const received = Buffer.from(code);
      if (candidate.length === received.length && timingSafeEqual(candidate, received)) return true;
    }
    return false;
  }
  private secret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET_MISCONFIGURED');
    return secret;
  }
}
