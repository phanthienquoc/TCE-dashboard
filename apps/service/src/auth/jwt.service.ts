import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AccessClaims {
  sub: string;
  role: string;
  typ: 'access';
  iss: string;
  aud: string[];
  iat: number;
  exp: number;
  jti: string;
  mfa_verified_at?: number;
}

@Injectable()
export class JwtService {
  // Validate at use time so a missing environment secret can never become a signing key.
  private get secret(): string {
    const value = process.env.JWT_SECRET;
    if (!value || value === 'CHANGE_ME_IN_ENV' || Buffer.byteLength(value) < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 bytes');
    }
    return value;
  }

  issue(userId: string, role: string, mfaVerifiedAt?: number): string {
    const now = Math.floor(Date.now() / 1000);
    const header = this.b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = this.b64(
      JSON.stringify({
        sub: userId,
        role,
        typ: 'access',
        iss: process.env.JWT_ISSUER ?? 'https://auth.mrcute.space',
        aud: (process.env.JWT_AUDIENCE ?? 'tce-dashboard,media-generation')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
        iat: now,
        exp: now + Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
        jti: randomBytes(16).toString('hex'),
        ...(typeof mfaVerifiedAt === 'number' &&
        Number.isSafeInteger(mfaVerifiedAt) &&
        mfaVerifiedAt >= 0 &&
        mfaVerifiedAt <= now
          ? { mfa_verified_at: mfaVerifiedAt }
          : {}),
      })
    );
    const body = `${header}.${payload}`;
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): AccessClaims {
    try {
      const [header, payload, signature, extra] = token.split('.');
      if (!header || !payload || !signature || extra) throw new Error('Malformed JWT');
      const parsed = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
      if (parsed.alg !== 'HS256' || parsed.typ !== 'JWT') throw new Error('Unsupported JWT');
      const expected = Buffer.from(this.sign(`${header}.${payload}`));
      const actual = Buffer.from(signature);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new Error('Bad signature');
      }

      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessClaims;
      const now = Math.floor(Date.now() / 1000);
      const issuer = process.env.JWT_ISSUER ?? 'https://auth.mrcute.space';
      const audiences = (process.env.JWT_AUDIENCE ?? 'tce-dashboard,media-generation')
        .split(',')
        .map(v => v.trim());
      if (
        !claims.sub ||
        claims.typ !== 'access' ||
        !Number.isFinite(claims.exp) ||
        claims.exp <= now ||
        !Number.isFinite(claims.iat) ||
        claims.iat > now + 60 ||
        claims.iss !== issuer ||
        !Array.isArray(claims.aud) ||
        !claims.aud.some(v => audiences.includes(v)) ||
        (claims.mfa_verified_at !== undefined &&
          (!Number.isSafeInteger(claims.mfa_verified_at) ||
            claims.mfa_verified_at < 0 ||
            claims.mfa_verified_at > now + 60))
      ) {
        throw new Error('Bad claims');
      }
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private sign(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }

  private b64(value: string) {
    return Buffer.from(value).toString('base64url');
  }
}
