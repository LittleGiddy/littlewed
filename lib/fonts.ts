// lib/fonts.ts
import path from 'path';
import fs from 'fs';
import os from 'os';

const fontsDir = path.join(process.cwd(), 'public', 'fonts');
const cacheDir = path.join(os.tmpdir(), 'fontconfig-cache');
const fontsConfPath = path.join(os.tmpdir(), 'fonts.conf');

try {
  fs.mkdirSync(cacheDir, { recursive: true });

  const files = fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir) : [];
  console.log(`[fonts] fontsDir=${fontsDir} files=${JSON.stringify(files)}`);

  if (files.length === 0) {
    console.error('[fonts] WARNING: public/fonts is empty - text will render as boxes.');
  }

  const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`;

  fs.writeFileSync(fontsConfPath, fontsConf);
  process.env.FONTCONFIG_FILE = fontsConfPath;

  console.log(`[fonts] FONTCONFIG_FILE=${fontsConfPath}`);
} catch (err) {
  console.error('[fonts] Failed to configure fontconfig:', err);
}