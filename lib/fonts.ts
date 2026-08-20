// lib/fonts.ts
import path from 'path';
import fs from 'fs';
import os from 'os';

let configured = false;

export function ensureFontsConfigured() {
  if (configured) return;

  try {
    // ─── Find the fonts directory ──────────────────────────────────────────
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'fonts'),
      path.join(process.cwd(), '..', 'public', 'fonts'),
      '/var/task/public/fonts',
    ];

    let fontsDir = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        fontsDir = p;
        break;
      }
    }

    if (!fontsDir) {
      console.warn('[Fonts] No fonts directory found');
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

    // ─── Use existing fonts.conf or create it ─────────────────────────────
    let fontsConfPath = path.join(fontsDir, 'fonts.conf');
    
    // If fonts.conf doesn't exist in fontsDir, create it in tmp
    if (!fs.existsSync(fontsConfPath)) {
      fontsConfPath = path.join(os.tmpdir(), 'fonts.conf');
      
      // Check if we have a fonts.conf in the project
      const projectConfig = path.join(process.cwd(), 'public', 'fonts', 'fonts.conf');
      if (fs.existsSync(projectConfig)) {
        fontsConfPath = projectConfig;
      } else {
        // Create a minimal fonts.conf
        const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  
  <!-- Map font names to local files -->
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
      }
    }

    // ─── Set environment variables ─────────────────────────────────────────
    process.env.FONTCONFIG_FILE = fontsConfPath;
    process.env.FONTCONFIG_PATH = path.dirname(fontsConfPath);
    
    // Also set for sharp specifically
    process.env.SHARP_FONTCONFIG = '1';

    console.log('[Fonts] Fontconfig configured at:', fontsConfPath);
    console.log('[Fonts] Cache directory:', cacheDir);

    configured = true;
  } catch (error) {
    console.error('[Fonts] Failed to configure fonts:', error);
  }
}

// ─── Helper to get font family for SVG ──────────────────────────────────
export function getFontFamilyForSvg(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Playfair Display': 'PlayfairDisplay',
    'DM Sans': 'DMSans',
    'Roboto': 'Roboto',
    'Lora': 'Lora',
    'Montserrat': 'Montserrat',
    'Georgia': 'Georgia',
    'Open Sans': 'OpenSans',
    'Raleway': 'Raleway',
    'Nunito': 'Nunito',
    'Poppins': 'Poppins',
    'Great Vibes': 'GreatVibes',
    'Parisienne': 'Parisienne',
    'Alex Brush': 'AlexBrush',
    'Tangerine': 'Tangerine',
    'Dancing Script': 'DancingScript',
    'Pacifico': 'Pacifico',
    'Satisfy': 'Satisfy',
    'Cedarville Cursive': 'CedarvilleCursive',
    'Kaushan Script': 'KaushanScript',
  };
  return fontMap[fontFamily] || fontFamily;
}