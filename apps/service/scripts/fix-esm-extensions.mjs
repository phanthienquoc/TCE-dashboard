import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist/apps/service');
const jsFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.js')) jsFiles.push(full);
  }
}

walk(root);

// Node ESM requires explicit file extensions. Do not use path.extname(value)
// here: './app.module' has '.module' as an extname even though it is an
// extensionless module specifier and must become './app.module.js'.
const specifier = /((?:from\s+|import\s*\(\s*|export\s+[^;]*?from\s+)["'])(\.{1,2}\/[^"']+)(["'])/g;

for (const file of jsFiles) {
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(specifier, (match, prefix, value, quote) => {
    if (value.endsWith('.js') || value.endsWith('.mjs') || value.endsWith('.cjs')) {
      return match;
    }

    const candidate = path.resolve(path.dirname(file), value);
    if (fs.existsSync(candidate + '.js')) return `${prefix}${value}.js${quote}`;
    if (fs.existsSync(path.join(candidate, 'index.js'))) return `${prefix}${value}/index.js${quote}`;
    return match;
  });
  fs.writeFileSync(file, source);
}
