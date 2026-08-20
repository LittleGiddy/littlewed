// scripts/copy-fonts.js
const fs = require('fs');
const path = require('path');

const FONTS = [
  { pkg: '@fontsource/playfair-display', files: ['playfair-display-latin-400-normal.woff2', 'playfair-display-latin-700-normal.woff2'] },
  { pkg: '@fontsource/dm-sans', files: ['dm-sans-latin-400-normal.woff2', 'dm-sans-latin-700-normal.woff2'] },
  { pkg: '@fontsource/roboto', files: ['roboto-latin-400-normal.woff2', 'roboto-latin-700-normal.woff2'] },
  { pkg: '@fontsource/lora', files: ['lora-latin-400-normal.woff2', 'lora-latin-700-normal.woff2'] },
  { pkg: '@fontsource/montserrat', files: ['montserrat-latin-400-normal.woff2', 'montserrat-latin-700-normal.woff2'] },
  { pkg: '@fontsource/open-sans', files: ['open-sans-latin-400-normal.woff2', 'open-sans-latin-700-normal.woff2'] },
  { pkg: '@fontsource/raleway', files: ['raleway-latin-400-normal.woff2', 'raleway-latin-700-normal.woff2'] },
  { pkg: '@fontsource/nunito', files: ['nunito-latin-400-normal.woff2', 'nunito-latin-700-normal.woff2'] },
  { pkg: '@fontsource/poppins', files: ['poppins-latin-400-normal.woff2', 'poppins-latin-700-normal.woff2'] },
  { pkg: '@fontsource/great-vibes', files: ['great-vibes-latin-400-normal.woff2'] },
  { pkg: '@fontsource/parisienne', files: ['parisienne-latin-400-normal.woff2'] },
  { pkg: '@fontsource/alex-brush', files: ['alex-brush-latin-400-normal.woff2'] },
  { pkg: '@fontsource/tangerine', files: ['tangerine-latin-400-normal.woff2', 'tangerine-latin-700-normal.woff2'] },
  { pkg: '@fontsource/dancing-script', files: ['dancing-script-latin-400-normal.woff2', 'dancing-script-latin-700-normal.woff2'] },
  { pkg: '@fontsource/pacifico', files: ['pacifico-latin-400-normal.woff2'] },
  { pkg: '@fontsource/satisfy', files: ['satisfy-latin-400-normal.woff2'] },
  { pkg: '@fontsource/cedarville-cursive', files: ['cedarville-cursive-latin-400-normal.woff2'] },
  { pkg: '@fontsource/kaushan-script', files: ['kaushan-script-latin-400-normal.woff2'] },
];

const outDir = path.join(process.cwd(), 'public', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const { pkg, files } of FONTS) {
  for (const file of files) {
    const src = path.join(process.cwd(), 'node_modules', pkg, 'files', file);
    const dest = path.join(outDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      copied++;
    } else {
      console.warn(`Font file not found, skipping: ${src}`);
    }
  }
}
console.log(`Copied ${copied} font files to ${outDir}`);