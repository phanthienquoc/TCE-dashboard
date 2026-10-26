import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Keycloak signature bytes are copied to an ArrayBuffer-backed view', () => {
  const source = new Uint8Array([1, 2, 3]);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);

  assert.notEqual(copy.buffer, source.buffer);
  assert.equal(copy.buffer instanceof ArrayBuffer, true);
  assert.deepEqual([...copy], [1, 2, 3]);
});
