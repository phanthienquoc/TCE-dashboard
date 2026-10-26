import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const keycloakSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../web/lib/keycloak-sso.ts'),
  'utf8'
);

test('production Keycloak verifier copies the signature before WebCrypto verification', () => {
  assert.match(
    keycloakSource,
    /function toArrayBufferView\(bytes: Uint8Array\): Uint8Array<ArrayBuffer>\s*\{\s*const copy = new Uint8Array\(new ArrayBuffer\(bytes\.byteLength\)\);\s*copy\.set\(bytes\);\s*return copy;\s*\}/
  );
  assert.match(
    keycloakSource,
    /crypto\.subtle\.verify\([\s\S]*?toArrayBufferView\(decodeBase64Url\(parts\[2\]\)\)/
  );
});

test('ArrayBuffer-backed signature copy preserves bytes without aliasing input', () => {
  const source = new Uint8Array([1, 2, 3]);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);

  assert.notEqual(copy.buffer, source.buffer);
  assert.equal(copy.buffer instanceof ArrayBuffer, true);
  assert.deepEqual([...copy], [1, 2, 3]);
});
