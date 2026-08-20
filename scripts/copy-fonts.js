// scripts/copy-fonts.js
const fs = require('fs');
const path = require('path');

// ─── ALL 19 fonts from the designer ─────────────────────────────────────
const fonts = [
  { src: 'node_modules/@fontsource/playfair-display/files', name: 'PlayfairDisplay', family: 'Playfair Display' },
  { src: 'node_modules/@fontsource/dm-sans/files', name: 'DMSans', family: 'DM Sans' },
  { src: 'node_modules/@fontsource/roboto/files', name: 'Roboto', family: 'Roboto' },
  { src: 'node_modules/@fontsource/lora/files', name: 'Lora', family: 'Lora' },
  { src: 'node_modules/@fontsource/montserrat/files', name: 'Montserrat', family: 'Montserrat' },
  { src: 'node_modules/@fontsource/open-sans/files', name: 'OpenSans', family: 'Open Sans' },
  { src: 'node_modules/@fontsource/raleway/files', name: 'Raleway', family: 'Raleway' },
  { src: 'node_modules/@fontsource/nunito/files', name: 'Nunito', family: 'Nunito' },
  { src: 'node_modules/@fontsource/poppins/files', name: 'Poppins', family: 'Poppins' },
  { src: 'node_modules/@fontsource/great-vibes/files', name: 'GreatVibes', family: 'Great Vibes' },
  { src: 'node_modules/@fontsource/parisienne/files', name: 'Parisienne', family: 'Parisienne' },
  { src: 'node_modules/@fontsource/alex-brush/files', name: 'AlexBrush', family: 'Alex Brush' },
  { src: 'node_modules/@fontsource/tangerine/files', name: 'Tangerine', family: 'Tangerine' },
  { src: 'node_modules/@fontsource/dancing-script/files', name: 'DancingScript', family: 'Dancing Script' },
  { src: 'node_modules/@fontsource/pacifico/files', name: 'Pacifico', family: 'Pacifico' },
  { src: 'node_modules/@fontsource/satisfy/files', name: 'Satisfy', family: 'Satisfy' },
  { src: 'node_modules/@fontsource/cedarville-cursive/files', name: 'CedarvilleCursive', family: 'Cedarville Cursive' },
  { src: 'node_modules/@fontsource/kaushan-script/files', name: 'KaushanScript', family: 'Kaushan Script' },
  // Georgia is a system font, no need to bundle
];

const targetDir = path.join(__dirname, '../public/fonts');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('📁 Target directory:', targetDir);

// ─── Copy font files ─────────────────────────────────────────────────────
let copiedCount = 0;

fonts.forEach(({ src, name, family }) => {
  const srcPath = path.join(__dirname, '..', src);
  
  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️ Font source not found: ${src} (${family})`);
    return;
  }

  const files = fs.readdirSync(srcPath);
  
  // Find font files (ttf, otf, woff2) - prefer woff2
  const fontFiles = files.filter(f => 
    f.endsWith('.woff2') || f.endsWith('.ttf') || f.endsWith('.otf')
  );

  if (fontFiles.length === 0) {
    console.warn(`⚠️ No font files found for ${name}`);
    return;
  }

  // Select the best file (prefer woff2, then ttf)
  let selectedFile = fontFiles.find(f => f.endsWith('.woff2') && (f.includes('regular') || f.includes('400')));
  if (!selectedFile) {
    selectedFile = fontFiles.find(f => f.endsWith('.woff2'));
  }
  if (!selectedFile) {
    selectedFile = fontFiles.find(f => f.endsWith('.ttf') && (f.includes('regular') || f.includes('400')));
  }
  if (!selectedFile) {
    selectedFile = fontFiles.find(f => f.endsWith('.ttf'));
  }
  if (!selectedFile) {
    selectedFile = fontFiles[0];
  }

  const ext = path.extname(selectedFile);
  const destFileName = `${name}${ext}`;
  const srcFile = path.join(srcPath, selectedFile);
  const destFile = path.join(targetDir, destFileName);
  
  try {
    fs.copyFileSync(srcFile, destFile);
    console.log(`✅ Copied ${family} → ${destFileName}`);
    copiedCount++;
  } catch (err) {
    console.error(`❌ Failed to copy ${family}:`, err.message);
  }
});

console.log(`\n✅ Copied ${copiedCount} font files to ${targetDir}`);

// ─── Create fontconfig file with ALL font mappings ──────────────────────
const fontsConfContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${targetDir.replace(/\\/g, '/')}</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  
  <!-- All font family mappings -->
  <match target="pattern">
    <test qual="any" name="family"><string>Playfair Display</string></test>
    <edit name="family" mode="assign" binding="strong"><string>PlayfairDisplay</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>DM Sans</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DMSans</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Roboto</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Roboto</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Lora</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Lora</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Montserrat</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Montserrat</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Open Sans</string></test>
    <edit name="family" mode="assign" binding="strong"><string>OpenSans</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Raleway</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Raleway</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Nunito</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Nunito</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Poppins</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Poppins</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Great Vibes</string></test>
    <edit name="family" mode="assign" binding="strong"><string>GreatVibes</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Parisienne</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Parisienne</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Alex Brush</string></test>
    <edit name="family" mode="assign" binding="strong"><string>AlexBrush</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Tangerine</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Tangerine</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Dancing Script</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DancingScript</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Pacifico</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Pacifico</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Satisfy</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Satisfy</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Cedarville Cursive</string></test>
    <edit name="family" mode="assign" binding="strong"><string>CedarvilleCursive</string></edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family"><string>Kaushan Script</string></test>
    <edit name="family" mode="assign" binding="strong"><string>KaushanScript</string></edit>
  </match>
  
  <!-- Fallback aliases -->
  <alias>
    <family>serif</family>
    <prefer><family>PlayfairDisplay</family><family>Georgia</family></prefer>
  </alias>
  <alias>
    <family>sans-serif</family>
    <prefer><family>DMSans</family><family>Arial</family></prefer>
  </alias>
  <alias>
    <family>cursive</family>
    <prefer><family>DancingScript</family><family>GreatVibes</family></prefer>
  </alias>
</fontconfig>`;

const configPath = path.join(targetDir, 'fonts.conf');
fs.writeFileSync(configPath, fontsConfContent);
console.log(`✅ Created fontconfig at ${configPath}`);

console.log('\n📋 Available font files:');
const files = fs.readdirSync(targetDir);
files.filter(f => f.endsWith('.woff2') || f.endsWith('.ttf') || f.endsWith('.otf'))
  .forEach(f => console.log(`  - ${f}`));

console.log('\n✅ Font setup complete!');