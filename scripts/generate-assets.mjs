import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../assets/images');

// App icon SVG — indigo background, white house with receipt lines
const iconSvg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1024" height="1024" fill="#6366F1"/>

  <!-- House body -->
  <polygon points="512,195 175,470 248,470 248,810 776,810 776,470 849,470"
    fill="white"/>

  <!-- Door -->
  <rect x="434" y="610" width="156" height="200" rx="14" fill="#6366F1"/>
  <!-- Door knob -->
  <circle cx="574" cy="715" r="10" fill="white" opacity="0.6"/>

  <!-- Left window — bill/receipt -->
  <rect x="278" y="530" width="130" height="160" rx="12" fill="#EEF2FF"/>
  <rect x="299" y="560" width="88" height="10" rx="5" fill="#6366F1" opacity="0.7"/>
  <rect x="299" y="582" width="88" height="10" rx="5" fill="#6366F1" opacity="0.7"/>
  <rect x="299" y="604" width="60" height="10" rx="5" fill="#6366F1" opacity="0.5"/>
  <rect x="299" y="632" width="88" height="10" rx="5" fill="#6366F1" opacity="0.3"/>
  <rect x="299" y="654" width="70" height="10" rx="5" fill="#6366F1" opacity="0.3"/>

  <!-- Right window — coin/rupee -->
  <rect x="616" y="530" width="130" height="160" rx="12" fill="#EEF2FF"/>
  <circle cx="681" cy="610" r="42" fill="none" stroke="#6366F1" stroke-width="10" opacity="0.7"/>
  <text x="681" y="626" font-family="Arial" font-size="44" font-weight="700"
    fill="#6366F1" text-anchor="middle" opacity="0.8">₹</text>
</svg>
`;

// Splash icon SVG — white background, centered indigo house (no text, just icon)
const splashSvg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <!-- House body -->
  <polygon points="256,60 88,210 124,210 124,430 388,430 388,210 424,210"
    fill="#6366F1"/>

  <!-- Door -->
  <rect x="218" y="298" width="76" height="132" rx="8" fill="white"/>
  <!-- Door knob -->
  <circle cx="283" cy="365" r="5" fill="#6366F1" opacity="0.5"/>

  <!-- Left window -->
  <rect x="138" y="246" width="64" height="80" rx="6" fill="white" opacity="0.9"/>
  <rect x="148" y="262" width="44" height="5" rx="3" fill="#6366F1" opacity="0.5"/>
  <rect x="148" y="273" width="44" height="5" rx="3" fill="#6366F1" opacity="0.5"/>
  <rect x="148" y="284" width="30" height="5" rx="3" fill="#6366F1" opacity="0.4"/>

  <!-- Right window -->
  <rect x="310" y="246" width="64" height="80" rx="6" fill="white" opacity="0.9"/>
  <circle cx="342" cy="287" r="20" fill="none" stroke="#6366F1" stroke-width="5" opacity="0.6"/>
  <text x="342" y="296" font-family="Arial" font-size="22" font-weight="700"
    fill="#6366F1" text-anchor="middle" opacity="0.7">₹</text>
</svg>
`;

async function generate() {
  // 1. App icon — 1024×1024
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(OUT, 'icon.png'));
  console.log('✓ icon.png');

  // 2. Splash icon — 512×512 on white canvas (expo-splash-screen centers this)
  const splashBuf = await sharp(Buffer.from(splashSvg))
    .resize(512, 512)
    .png()
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: splashBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  // 3. Favicon (32×32)
  await sharp(Buffer.from(iconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(OUT, 'favicon.png'));
  console.log('✓ favicon.png');

  // 4. Android adaptive icon foreground — 432×432 on transparent
  //    (the house, centered, with padding so it fits in the safe zone)
  const fgBuf = await sharp(Buffer.from(splashSvg))
    .resize(320, 320)
    .png()
    .toBuffer();

  await sharp({
    create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fgBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');

  // 5. Android adaptive icon background — solid indigo
  await sharp({
    create: { width: 432, height: 432, channels: 3, background: { r: 99, g: 102, b: 241 } },
  })
    .png()
    .toFile(path.join(OUT, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  // 6. Android monochrome — white house on transparent
  const monoBuf = await sharp(Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <polygon points="256,60 88,210 124,210 124,430 388,430 388,210 424,210" fill="white"/>
      <rect x="218" y="298" width="76" height="132" rx="8" fill="#6366F1"/>
      <rect x="138" y="246" width="64" height="80" rx="6" fill="white" opacity="0.4"/>
      <rect x="310" y="246" width="64" height="80" rx="6" fill="white" opacity="0.4"/>
    </svg>
  `))
    .resize(320, 320)
    .png()
    .toBuffer();

  await sharp({
    create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: monoBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');

  console.log('\nAll assets generated.');
}

generate().catch(err => { console.error(err); process.exit(1); });
