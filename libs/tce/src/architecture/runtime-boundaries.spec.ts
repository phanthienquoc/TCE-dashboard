import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';

const repositoryRoot = process.cwd();

function sourceFiles(directory: string): string[] {
  const absoluteDirectory = resolve(repositoryRoot, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative(repositoryRoot, fullPath));
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function importsMatching(files: string[], pattern: RegExp): string[] {
  return files.flatMap(file => {
    const content = readFileSync(file, 'utf8');
    return pattern.test(content) ? [relative(repositoryRoot, file)] : [];
  });
}

describe('TCE runtime dependency boundaries', () => {
  it('keeps the pure engine free of persistence, provider SDKs, and DRE imports', () => {
    const files = sourceFiles('libs/tce-engine/src');
    const forbidden =
      /(?:from\s*|import\s*\()\s*['"][^'"]*(?:@tce\/(?:ssi|dre|platform)|@ssi\/developer\/ssi-sdk|@supabase\/|mongodb|apps\/service\/src\/dre|\/dre\/)[^'"]*['"]/;
    assert.deepEqual(importsMatching(files, forbidden), []);
  });

  it('keeps TCE decision/scanner code free of provider SDK and DRE imports', () => {
    const files = [...sourceFiles('libs/tce/src/decision'), ...sourceFiles('libs/tce/src/scanner')];
    const forbidden =
      /(?:from\s*|import\s*\()\s*['"][^'"]*(?:@tce\/(?:ssi|dre|platform)|@ssi\/developer\/ssi-sdk|binance-api-node|\/dre\/)[^'"]*['"]/;
    assert.deepEqual(importsMatching(files, forbidden), []);
  });

  it('keeps Monitor and DRE behind provider-neutral ports instead of importing broker SDKs', () => {
    const files = [
      ...sourceFiles('apps/service/src/monitor'),
      ...sourceFiles('apps/service/src/dre'),
    ];
    const forbidden =
      /(?:from\s*|import\s*\()\s*['"][^'"]*(?:@tce\/ssi|@ssi\/developer\/ssi-sdk|binance-api-node|@binance\/)[^'"]*['"]/;
    assert.deepEqual(importsMatching(files, forbidden), []);
  });

  it('keeps DRE campaign lifecycle separate from TCE strategy and execution dispatch', () => {
    const files = sourceFiles('apps/service/src/dre');
    const forbidden =
      /(?:from\s*|import\s*\()\s*['"][^'"]*(?:@tce\/tce-engine|@tce\/decision|libs\/tce\/src\/(?:decision|execution)|execution-orchestrator|SafeOrderExecutionService|@tce\/execution)[^'"]*['"]/;
    assert.deepEqual(importsMatching(files, forbidden), []);
  });
});
