#!/usr/bin/env node
// Copies server/dist → electron/server-dist before packaging
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'server', 'dist');
const dst = path.join(root, 'electron', 'server-dist');

if (!fs.existsSync(src)) {
  console.error('ERROR: server/dist not found — run pnpm run build:server first');
  process.exit(1);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// Clean and copy
if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
copyDir(src, dst);
console.log(`Copied server/dist → electron/server-dist (${fs.readdirSync(dst, { recursive: true }).length} files)`);
