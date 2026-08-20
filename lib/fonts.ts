// lib/fonts.ts
import path from 'path';
import fs from 'fs';
import os from 'os';

let configured = false;

export function ensureFontsConfigured() {
  if (configured) return;

  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  const cacheDir = path.join(os.tmpdir(), 'fontconfig-cache');
  const fontsConfPath = path.join(os.tmpdir(), 'fonts.conf');

  fs.mkdirSync(cacheDir, { recursive: true });

  const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`;

  fs.writeFileSync(fontsConfPath, fontsConf);
  process.env.FONTCONFIG_FILE = fontsConfPath;

  configured = true;
}