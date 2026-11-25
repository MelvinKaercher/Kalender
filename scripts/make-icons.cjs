// Erzeugt die App-Icons (PNG) aus einem SVG. Aufruf: node scripts/make-icons.cjs
// Nutzt das vorhandene Playwright/Chromium zum Rendern.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Vollflächig (iOS rundet die Ecken selbst ab, Transparenz würde schwarz).
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d65f5"/>
      <stop offset="1" stop-color="#3f37c9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Kalenderblatt -->
  <rect x="116" y="132" width="280" height="264" rx="44" fill="#fff"/>
  <path d="M116 176a44 44 0 0 1 44-44h192a44 44 0 0 1 44 44v34H116z" fill="#fff" opacity=".0"/>
  <rect x="116" y="204" width="280" height="6" fill="#4f46e5" opacity=".14"/>
  <!-- Ringe -->
  <rect x="184" y="104" width="24" height="64" rx="12" fill="#fff"/>
  <rect x="304" y="104" width="24" height="64" rx="12" fill="#fff"/>
  <!-- heutiger Tag -->
  <circle cx="318" cy="304" r="36" fill="#4f46e5"/>
  <circle cx="194" cy="304" r="9" fill="#4f46e5" opacity=".25"/>
  <circle cx="238" cy="304" r="9" fill="#4f46e5" opacity=".25"/>
  <circle cx="194" cy="354" r="9" fill="#4f46e5" opacity=".25"/>
  <circle cx="238" cy="354" r="9" fill="#4f46e5" opacity=".25"/>
  <circle cx="282" cy="354" r="9" fill="#4f46e5" opacity=".25"/>
</svg>`;

const sizes = { 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180 };

(async () => {
  const outDir = path.join(__dirname, '..', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const [file, size] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:#4f46e5}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(outDir, file), omitBackground: false });
    await page.close();
    console.log('✓', file, `${size}×${size}`);
  }
  fs.writeFileSync(path.join(outDir, 'icon.svg'), svg.trim() + '\n');
  await browser.close();
})();
