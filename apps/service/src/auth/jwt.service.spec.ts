import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { test } from 'node:test';
import { JwtService } from './jwt.service';

const validSecret = 'tce-jwt-test-secret-at-least-32-bytes';

function withSecret<T>(secret: string | undefined, run: () => T): T {
  const previous = process.env.JWT_SECRET;
  if (secret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secret;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
}

function signedToken(secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'test-user',
      role: 'ADMIN',
      typ: 'access',
      iat: now,
      exp: now + 60,
      jti: 'test-jti',
    })
  ).toString('base64url');
  const body = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

test('rejects placeholder-signed token with no secret', () => {
  withSecret(undefined, () => {
    const jwt = new JwtService();
    const forgedWithPublicPlaceholder = signedToken('CHANGE_ME_IN_ENV');
    assert.throws(() => jwt.verify(forgedWithPublicPlaceholder), UnauthorizedException);
  });
});

test('rejects placeholder and short secrets', () => {
  withSecret('CHANGE_ME_IN_ENV', () => {
    assert.throws(
      () => new JwtService().verify(signedToken('CHANGE_ME_IN_ENV')),
      UnauthorizedException
    );
  });
  withSecret('short-secret', () => {
    assert.throws(
      () => new JwtService().verify(signedToken('short-secret')),
      UnauthorizedException
    );
  });
});

test('issues and verifies with a strong secret', () => {
  withSecret(validSecret, () => {
    const jwt = new JwtService();
    const token = jwt.issue('user-1', 'USER');
    assert.equal(jwt.verify(token).sub, 'user-1');
  });
});

test('refuses issuance with a short secret', () => {
  withSecret('short-secret', () => {
    assert.throws(() => new JwtService().issue('user-1', 'USER'), /JWT_SECRET/);
  });
});

test('refuses issuance when the secret is missing', () => {
  withSecret(undefined, () => {
    assert.throws(() => new JwtService().issue('user-1', 'USER'), /JWT_SECRET/);
  });
});
