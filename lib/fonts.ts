// lib/fonts.ts
import path from 'path';
import fs from 'fs';
import os from 'os';

let configured = false;

export function ensureFontsConfigured() {
  if (configured) return;

  try {
    // ─── Find the fonts directory ──────────────────────────────────────────
    const fontsDir = path.join(process.cwd(), 'public', 'fonts');
    
    if (!fs.existsSync(fontsDir)) {
      console.warn('[Fonts] Fonts directory not found:', fontsDir);
      return;
    }

    console.log('[Fonts] Using fonts directory:', fontsDir);

    // ─── Check if we have font files ──────────────────────────────────────
    const fontFiles = fs.readdirSync(fontsDir).filter(f => 
      f.endsWith('.ttf') || f.endsWith('.otf') || f.endsWith('.woff2')
    );

    if (fontFiles.length === 0) {
      console.warn('[Fonts] No font files found in:', fontsDir);
      return;
    }

    console.log('[Fonts] Found font files:', fontFiles);

    // ─── Create cache directory ────────────────────────────────────────────
    const cacheDir = path.join(os.tmpdir(), 'fontconfig-cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // ─── Check if fonts.conf exists ──────────────────────────────────────
    let fontsConfPath = path.join(fontsDir, 'fonts.conf');
    
    if (!fs.existsSync(fontsConfPath)) {
      console.warn('[Fonts] fonts.conf not found, creating one...');
      
      const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  
  <match target="pattern">
    <test qual="any" name="family">
      <string>Playfair Display</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>PlayfairDisplay</string>
    </edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family">
      <string>DM Sans</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>DMSans</string>
    </edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family">
      <string>Dancing Script</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>DancingScript</string>
    </edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family">
      <string>Great Vibes</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>GreatVibes</string>
    </edit>
  </match>
</fontconfig>`;
      
      fs.writeFileSync(fontsConfPath, fontsConf);
      console.log('[Fonts] Created fonts.conf at:', fontsConfPath);
    }

    // ─── Set environment variables ─────────────────────────────────────────
    process.env.FONTCONFIG_FILE = fontsConfPath;
    process.env.FONTCONFIG_PATH = fontsDir;
    process.env.SHARP_FONTCONFIG = '1';

    console.log('[Fonts] Fontconfig configured at:', fontsConfPath);
    configured = true;
  } catch (error) {
    console.error('[Fonts] Failed to configure fonts:', error);
  }
}