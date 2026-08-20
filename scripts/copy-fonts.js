// scripts/copy-fonts.js
const fs = require('fs');
const path = require('path');

const FONTS = [
  { pkg: '@fontsource/playfair-display', files: ['playfair-display-latin-400-normal.woff2', 'playfair-display-latin-700-normal.woff2'] },
  { pkg: '@fontsource/dm-sans', files: ['dm-sans-latin-400-normal.woff2', 'dm-sans-latin-700-normal.woff2'] },
  { pkg: '@fontsource/dancing-script', files: ['dancing-script-latin-400-normal.woff2', 'dancing-script-latin-700-normal.woff2'] },
  { pkg: '@fontsource/great-vibes', files: ['great-vibes-latin-400-normal.woff2'] },
];

const outDir = path.join(process.cwd(), 'public', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

for (const { pkg, files } of FONTS) {
  for (const file of files) {
    const src = path.join(process.cwd(), 'node_modules', pkg, 'files', file);
    const dest = path.join(outDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    } else {
      console.warn(`Font file not found, skipping: ${src}`);
    }
  }
}
console.log(`Copied fonts to ${outDir}`);