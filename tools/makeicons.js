// Draws the app icons (an original pixel-art grass block, not a Mojang texture) into assets/icons with the
// browser's canvas: node tools/makeicons.js
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const out = await p.evaluate(() => {
    // a 16 x 16 face drawn from a seeded noise, then the cube in isometric view
    let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const face = (top) => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let col;
        if (top) { const v = rnd(); col = v < 0.25 ? '#4f9a2c' : v < 0.6 ? '#5fb336' : v < 0.85 ? '#6cc23f' : '#7ad04a'; }
        else if (y < 3 || (y === 3 && rnd() < 0.6)) { const v = rnd(); col = v < 0.5 ? '#5fb336' : '#4f9a2c'; }
        else { const v = rnd(); col = v < 0.2 ? '#6b4a2e' : v < 0.55 ? '#7d5736' : v < 0.85 ? '#8c6440' : '#9a7350'; }
        g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      return c; };
    const top = face(true), side = face(false);
    const draw = (size, pad, bg) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      if (bg) { const gr = g.createLinearGradient(0, 0, 0, size); gr.addColorStop(0, '#7fb8ff'); gr.addColorStop(1, '#c9e4ff'); g.fillStyle = gr; g.fillRect(0, 0, size, size); }
      const w = size - pad * 2, cx = size / 2, h = w / 2, x0 = cx - w / 2, y0 = pad + (w - (h + w * 0.58)) / 2;
      // top: a rhombus; left and right sides: parallelograms, darker
      const quad = (img, a, bb, cc, shade) => { g.save(); g.setTransform(a[0], a[1], bb[0], bb[1], cc[0], cc[1]); g.drawImage(img, 0, 0, 16, 16, 0, 0, 1, 1); if (shade) { g.fillStyle = 'rgba(0,0,0,' + shade + ')'; g.fillRect(0, 0, 1, 1); } g.restore(); };
      const T = [cx, y0], L = [x0, y0 + h / 2], R = [x0 + w, y0 + h / 2], B = [cx, y0 + h], dy = w * 0.58;
      quad(top, [R[0] - T[0], R[1] - T[1]], [L[0] - T[0], L[1] - T[1]], T, 0);
      quad(side, [B[0] - L[0], B[1] - L[1]], [0, dy], L, 0.18);
      quad(side, [R[0] - B[0], R[1] - B[1]], [0, dy], B, 0.38);
      return c.toDataURL('image/png').split(',')[1]; };
    return { i192: draw(192, 18, true), i512: draw(512, 48, true), mask: draw(512, 110, true), apple: draw(180, 16, true), fav: draw(64, 4, false) };
  });
  const dir = path.join(__dirname, '..', 'assets', 'icons');
  for (const [k, f] of [['i192', 'icon-192.png'], ['i512', 'icon-512.png'], ['mask', 'icon-maskable-512.png'], ['apple', 'apple-touch-icon.png'], ['fav', 'favicon-64.png']]) fs.writeFileSync(path.join(dir, f), Buffer.from(out[k], 'base64'));
  await b.close(); console.log('icons written');
})();
