// scripts/copy-fonts.js
const fs = require('fs');
const path = require('path');

const fonts = [
  { 
    src: 'node_modules/@fontsource/playfair-display/files', 
    name: 'PlayfairDisplay',
    // The actual font family name inside the font file
    family: 'Playfair Display'
  },
  { 
    src: 'node_modules/@fontsource/dm-sans/files', 
    name: 'DMSans',
    family: 'DM Sans'
  },
  { 
    src: 'node_modules/@fontsource/dancing-script/files', 
    name: 'DancingScript',
    family: 'Dancing Script'
  },
  { 
    src: 'node_modules/@fontsource/great-vibes/files', 
    name: 'GreatVibes',
    family: 'Great Vibes'
  },
];

const targetDir = path.join(__dirname, '../public/fonts');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// ─── Copy font files with proper naming ──────────────────────────────────
fonts.forEach(({ src, name, family }) => {
  const srcPath = path.join(__dirname, '..', src);
  
  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️ Font source not found: ${src}`);
    return;
  }

  const files = fs.readdirSync(srcPath);
  
  // Find font files (ttf, otf, woff2) - prefer woff2, then ttf
  let fontFiles = files.filter(f => 
    f.endsWith('.ttf') || f.endsWith('.otf') || f.endsWith('.woff2')
  );

  if (fontFiles.length === 0) {
    console.warn(`⚠️ No font files found for ${name}`);
    return;
  }

  // Sort: prefer woff2 over ttf, and look for non-variable fonts
  const preferred = fontFiles.filter(f => f.endsWith('.woff2') && !f.includes('variable'));
  const fallback = fontFiles.filter(f => f.endsWith('.ttf') && !f.includes('variable'));
  const variable = fontFiles.filter(f => f.includes('variable'));
  
  let selectedFiles = [];
  
  // Try to find regular weight first
  const regular = preferred.find(f => f.includes('regular') || f.includes('400'));
  if (regular) {
    selectedFiles.push(regular);
  } else if (preferred.length > 0) {
    selectedFiles.push(preferred[0]);
  } else if (fallback.length > 0) {
    selectedFiles.push(fallback[0]);
  } else if (variable.length > 0) {
    selectedFiles.push(variable[0]);
  } else {
    selectedFiles.push(fontFiles[0]);
  }

  // Also try to find bold weight
  const bold = preferred.find(f => f.includes('bold') || f.includes('700'));
  if (bold && bold !== selectedFiles[0]) {
    selectedFiles.push(bold);
  }

  // Copy selected files with proper names
  selectedFiles.forEach((file, index) => {
    const srcFile = path.join(srcPath, file);
    const ext = path.extname(file);
    // Use name + weight suffix for multiple files, or just name for single
    let destFileName;
    if (selectedFiles.length > 1) {
      const suffix = file.includes('bold') ? '-Bold' : index === 0 ? '' : '-Regular';
      destFileName = `${name}${suffix}${ext}`;
    } else {
      destFileName = `${name}${ext}`;
    }
    const destFile = path.join(targetDir, destFileName);
    
    fs.copyFileSync(srcFile, destFile);
    console.log(`✅ Copied ${file} → ${destFileName}`);
  });
});

console.log(`✅ Fonts copied to ${targetDir}`);

// ─── Create fontconfig file ──────────────────────────────────────────────
const fontsConfContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${targetDir}</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  
  <!-- Font family mappings - maps Google Font names to local font files -->
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
  
  <!-- Additional font mappings for common fonts -->
  <match target="pattern">
    <test qual="any" name="family">
      <string>Georgia</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>Georgia</string>
    </edit>
  </match>
  
  <match target="pattern">
    <test qual="any" name="family">
      <string>Arial</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>Arial</string>
    </edit>
  </match>
  
  <!-- Fallback aliases -->
  <alias>
    <family>serif</family>
    <prefer>
      <family>PlayfairDisplay</family>
      <family>Georgia</family>
    </prefer>
  </alias>
  
  <alias>
    <family>sans-serif</family>
    <prefer>
      <family>DMSans</family>
      <family>Arial</family>
    </prefer>
  </alias>
  
  <alias>
    <family>cursive</family>
    <prefer>
      <family>DancingScript</family>
      <family>GreatVibes</family>
    </prefer>
  </alias>
</fontconfig>`;

const configPath = path.join(targetDir, 'fonts.conf');
fs.writeFileSync(configPath, fontsConfContent);
console.log(`✅ Created fontconfig at ${configPath}`);

// ─── Create a font list file for debugging ──────────────────────────────
const fontList = [];
if (fs.existsSync(targetDir)) {
  const files = fs.readdirSync(targetDir);
  files.forEach(file => {
    if (file.endsWith('.ttf') || file.endsWith('.otf') || file.endsWith('.woff2')) {
      fontList.push(file);
    }
  });
}

console.log('\n📋 Available font files:');
fontList.forEach(f => console.log(`  - ${f}`));
console.log('\n✅ Font setup complete!');