import test from 'node:test';
import assert from 'node:assert/strict';
import { PasswordService } from './password.service';

test('scrypt password hashes verify and reject incorrect inputs', async () => {
  const service = new PasswordService();
  const hash = await service.hash('test-password-strong');
  assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await service.verify('test-password-strong', hash), true);
  assert.equal(await service.verify('wrong-password', hash), false);
  assert.equal(await service.verify('bad', 'not-a-valid-hash'), false);
});
