import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MfaService } from './mfa.service';

test('TOTP accepts a valid six-digit code for the current time step', () => {
  const service = new MfaService();
  const secret = 'JBSWY3DPEHPK3PXP';
  const step = 2_000_000;
  const counter = Buffer.alloc(8); counter.writeBigInt64BE(BigInt(step));
  const digest = createHmac('sha1', Buffer.from(secret, 'base64url')).update(counter).digest();
  const index = digest[digest.length - 1] & 15;
  const value = ((digest[index] & 127) << 24) | (digest[index + 1] << 16) | (digest[index + 2] << 8) | digest[index + 3];
  const code = String(value % 1_000_000).padStart(6, '0');
  assert.equal(service.verifyTotp(secret, code, step), true);
  assert.equal(service.verifyTotp(secret, 'abcdef', step), false);
});
