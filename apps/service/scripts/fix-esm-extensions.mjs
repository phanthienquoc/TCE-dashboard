import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
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
const relativeSpecifier =
  /((?:from\s+|import\s*\(\s*|export\s+[^;]*?from\s+)["'])(\.{1,2}\/[^"']+)(["'])/g;
const packageSpecifier =
  /((?:from\s+|import\s*\(\s*|export\s+[^;]*?from\s+)["'])@tce\/([a-z0-9_-]+)([^"']*)(["'])/g;

function withJsExtension(file, value) {
  if (value.endsWith('.js') || value.endsWith('.mjs') || value.endsWith('.cjs')) return value;
  const candidate = path.resolve(path.dirname(file), value);
  if (fs.existsSync(candidate + '.js')) return `${value}.js`;
  if (fs.existsSync(path.join(candidate, 'index.js'))) return `${value}/index.js`;
  return value;
}

function resolveTcePackage(file, name, suffix) {
  const candidates = [
    path.join(root, 'libs', name, 'src'),
    path.join(root, 'packages', name, 'src'),
  ];

  for (const base of candidates) {
    const target = suffix
      ? path.join(base, suffix.replace(/^\//, ''))
      : path.join(base, 'index.js');
    const normalizedTarget = target.endsWith('.js') ? target : `${target}.js`;
    if (fs.existsSync(normalizedTarget)) {
      const relative = path.relative(path.dirname(file), normalizedTarget);
      return relative.startsWith('.') ? relative : `./${relative}`;
    }
  }

  return null;
}

for (const file of jsFiles) {
  let source = fs.readFileSync(file, 'utf8');

  source = source.replace(relativeSpecifier, (match, prefix, value, quote) => {
    return `${prefix}${withJsExtension(file, value)}${quote}`;
  });

  source = source.replace(packageSpecifier, (match, prefix, name, suffix, quote) => {
    const resolved = resolveTcePackage(file, name, suffix);
    if (!resolved) {
      throw new Error(`Unable to resolve @tce/${name}${suffix} from ${file}`);
    }
    return `${prefix}${resolved}${quote}`;
  });

  fs.writeFileSync(file, source);
}
