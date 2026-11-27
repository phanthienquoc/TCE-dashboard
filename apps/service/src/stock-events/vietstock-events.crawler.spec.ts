import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, '../../../..');
const dockerfile = readFileSync(resolve(repositoryRoot, 'apps/service/Dockerfile'), 'utf8');
const crawler = readFileSync(resolve(directory, 'vietstock-events.crawler.ts'), 'utf8');

test('Chrome Headless Shell stays in Puppeteer cache with adjacent ICU resources', () => {
  assert.match(dockerfile, /PUPPETEER_CACHE_DIR=\/app\/\.cache\/puppeteer/);
  assert.match(dockerfile, /puppeteer browsers install chrome-headless-shell/);
  assert.match(dockerfile, /icudtl\.dat/);
  assert.match(dockerfile, /locales/);
  assert.doesNotMatch(dockerfile, /PUPPETEER_EXECUTABLE_PATH/);
  assert.doesNotMatch(dockerfile, /\/app\/chrome-headless-shell/);
  assert.doesNotMatch(crawler, /PUPPETEER_EXECUTABLE_PATH/);
  assert.match(crawler, /headless: 'shell'/);
});
