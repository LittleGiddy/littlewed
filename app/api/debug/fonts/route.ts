// app/api/debug/fonts/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const debugInfo: any = {
    cwd: process.cwd(),
    fontConfigFile: process.env.FONTCONFIG_FILE,
    fontConfigPath: process.env.FONTCONFIG_PATH,
  };

  // Check public/fonts
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  if (fs.existsSync(fontsDir)) {
    debugInfo.fontsDir = fontsDir;
    debugInfo.fontFiles = fs.readdirSync(fontsDir);
  } else {
    debugInfo.fontsDir = fontsDir + ' (NOT FOUND)';
  }

  // Check if fonts.conf exists
  const configPath = path.join(fontsDir, 'fonts.conf');
  debugInfo.fontsConfExists = fs.existsSync(configPath);
  if (debugInfo.fontsConfExists) {
    debugInfo.fontsConfContent = fs.readFileSync(configPath, 'utf-8');
  }

  // Check environment
  debugInfo.env = {
    FONTCONFIG_FILE: process.env.FONTCONFIG_FILE,
    FONTCONFIG_PATH: process.env.FONTCONFIG_PATH,
    SHARP_FONTCONFIG: process.env.SHARP_FONTCONFIG,
  };

  return NextResponse.json(debugInfo);
}