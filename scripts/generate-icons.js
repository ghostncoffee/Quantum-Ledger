#!/usr/bin/env node
/**
 * Generates electron/build-assets/icon.png (512×512) from client/src/assets/logo.svg
 * electron-builder then auto-generates icon.ico from it for Windows installers.
 *
 * Run: node scripts/generate-icons.js
 */
const path = require('path');
const fs   = require('fs');

const root   = path.join(__dirname, '..');
const svgSrc = path.join(root, 'client', 'src', 'assets', 'logo.svg');
const outDir = path.join(root, 'electron', 'build-assets');
const outPng = path.join(outDir, 'icon.png');

async function main() {
  if (!fs.existsSync(svgSrc)) {
    console.error('SVG source not found:', svgSrc);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp is not installed. Run: npm install --save-dev sharp  (in the repo root)');
    process.exit(1);
  }

  await sharp(svgSrc)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  const size = fs.statSync(outPng).size;
  console.log(`✓ Generated ${outPng}  (${(size / 1024).toFixed(1)} KB)`);
  console.log('  electron-builder will auto-generate .ico from this PNG when you run: pnpm run package');
}

main().catch(err => { console.error(err); process.exit(1); });
