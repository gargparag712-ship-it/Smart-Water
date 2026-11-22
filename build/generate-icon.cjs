const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execSync } = require('node:child_process');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function savePng(width, height, rgbaBuffer, filePath) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const raw = Buffer.alloc(height * (width * 4 + 1));
  let srcOffset = 0;
  let dstOffset = 0;
  for (let y = 0; y < height; y++) {
    raw[dstOffset++] = 0;
    rgbaBuffer.copy(raw, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  fs.writeFileSync(filePath, Buffer.concat([sig, ihdrChunk, idat, iend]));
}

function buildIcns(pngMap) {
  const chunks = [];
  for (const [tag, pngBuf] of Object.entries(pngMap)) {
    const chunk = Buffer.alloc(8 + pngBuf.length);
    chunk.write(tag, 0, 4, 'ascii');
    chunk.writeUInt32BE(8 + pngBuf.length, 4);
    pngBuf.copy(chunk, 8);
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function squircleDist(px, py, cx = 512, cy = 512, hx = 412, hy = 412, r = 185) {
  const qx = Math.abs(px - cx) - (hx - r);
  const qy = Math.abs(py - cy) - (hy - r);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - r;
}

function dropletDist(px, py) {
  const x = Math.abs(px - 512);
  const y = py;
  const cy = 590, R = 195;
  const tipY = 245, tipR = 14;
  const tipCy = tipY + tipR;
  const d = cy - tipCy;
  const sinA = (R - tipR) / d;
  const cosA = Math.sqrt(1 - sinA * sinA);
  const distTangent = x * cosA - (y - tipCy) * sinA - tipR;
  const t = x * sinA + (y - tipCy) * cosA;
  const tEnd = d * cosA;

  if (t < 0) {
    return Math.hypot(x, y - tipCy) - tipR;
  } else if (t > tEnd) {
    return Math.hypot(x, y - cy) - R;
  } else {
    // Subtle organic inward curve for fluid waist
    const waistNorm = t / tEnd;
    const cinch = 4 * waistNorm * (1 - waistNorm) * 16;
    return distTangent + cinch;
  }
}

function renderMaster1024() {
  const W = 1024, H = 1024;
  const buf = Buffer.alloc(W * H * 4);
  let idx = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      // 2x2 supersampling for smooth antialiasing
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) / 2;
          const py = y + (sy + 0.5) / 2;

          // Drop shadow
          const dShadow = squircleDist(px, py, 512, 526, 410, 410, 185);
          let sr = 0, sg = 0, sb = 0, sa = 0;
          if (dShadow > 0 && dShadow < 42) {
            const sAlpha = Math.exp(-dShadow * dShadow / (2 * 18 * 18)) * 0.15;
            sr = 15; sg = 23; sb = 42; sa = sAlpha;
          }

          // Squircle canvas
          const dSquircle = squircleDist(px, py, 512, 512, 412, 412, 185);
          let br = sr, bg = sg, bb = sb, ba = sa;

          if (dSquircle <= 1.0) {
            const sqAlpha = clamp(0.5 - dSquircle, 0, 1);
            const grad = clamp(Math.hypot(px - 512, py - 460) / 500, 0, 1);
            let cr = lerp(255, 246, grad);
            let cg = lerp(255, 250, grad);
            let cb = lerp(255, 252, grad);

            // Subtle 1.5px teal-tinted border
            if (dSquircle > -2.5 && dSquircle <= 0.5) {
              const bAlpha = clamp(1.0 - Math.abs(dSquircle + 1.0) / 1.5, 0, 1);
              cr = lerp(cr, 13, bAlpha * 0.22);
              cg = lerp(cg, 148, bAlpha * 0.22);
              cb = lerp(cb, 136, bAlpha * 0.22);
            }

            // Central Water Droplet
            const dDrop = dropletDist(px, py);
            if (dDrop <= 1.0) {
              const dropAlpha = clamp(0.5 - dDrop, 0, 1);
              const v = clamp((py - 245) / 540, 0, 1);
              const h = clamp((px - 512) / 200, -1, 1);
              const g = clamp(v * 0.75 - h * 0.25, 0, 1);

              // Vibrant Teal to Deep Oceanic Blue gradient
              let dr, dg, db;
              if (g < 0.5) {
                const tMid = g / 0.5;
                dr = lerp(26, 13, tMid);
                dg = lerp(210, 155, tMid);
                db = lerp(195, 165, tMid);
              } else {
                const tBot = (g - 0.5) / 0.5;
                dr = lerp(13, 3, tBot);
                dg = lerp(155, 100, tBot);
                db = lerp(165, 168, tBot);
              }

              // Inner fluid wave crest
              const waveY = 620 + 20 * Math.sin((px - 512) / 140 * Math.PI - 0.5);
              if (py > waveY) {
                const waveDepth = clamp((py - waveY) / 120, 0, 1);
                dr = lerp(dr, 2, waveDepth * 0.45);
                dg = lerp(dg, 90, waveDepth * 0.45);
                db = lerp(db, 165, waveDepth * 0.45);
              }

              // Upper-left specular highlight arc
              const hx = px - 460;
              const hy = py - 380;
              const cosR = Math.cos(0.5);
              const sinR = Math.sin(0.5);
              const rx = hx * cosR - hy * sinR;
              const ry = hx * sinR + hy * cosR;
              const hDist = Math.hypot(rx / 15, ry / 55);
              if (hDist < 1.0) {
                const hAlpha = (1 - hDist) * 0.42;
                dr = lerp(dr, 255, hAlpha);
                dg = lerp(255, 255, hAlpha);
                db = lerp(255, 255, hAlpha);
              }

              // Composite droplet over squircle
              cr = lerp(cr, dr, dropAlpha);
              cg = lerp(cg, dg, dropAlpha);
              cb = lerp(cb, db, dropAlpha);
            }

            // Composite squircle over shadow
            br = lerp(br, cr, sqAlpha);
            bg = lerp(bg, cg, sqAlpha);
            bb = lerp(bb, cb, sqAlpha);
            ba = lerp(ba, 1.0, sqAlpha);
          }

          rSum += br * ba;
          gSum += bg * ba;
          bSum += bb * ba;
          aSum += ba;
        }
      }

      const finalA = aSum / 4;
      if (finalA > 0.001) {
        buf[idx++] = Math.round(clamp((rSum / 4) / finalA, 0, 255));
        buf[idx++] = Math.round(clamp((gSum / 4) / finalA, 0, 255));
        buf[idx++] = Math.round(clamp((bSum / 4) / finalA, 0, 255));
        buf[idx++] = Math.round(clamp(finalA * 255, 0, 255));
      } else {
        buf[idx++] = 0; buf[idx++] = 0; buf[idx++] = 0; buf[idx++] = 0;
      }
    }
  }

  return buf;
}

function main() {
  const buildDir = path.resolve(__dirname);
  fs.mkdirSync(buildDir, { recursive: true });

  const iconPngPath = path.join(buildDir, 'icon.png');
  const iconIcnsPath = path.join(buildDir, 'icon.icns');

  console.log('Rendering master 1024x1024 icon...');
  const masterBuf = renderMaster1024();
  savePng(1024, 1024, masterBuf, iconPngPath);
  console.log(`Saved master PNG: ${iconPngPath}`);

  // Downsample to standard sizes using sips
  const tempSizesDir = path.join(buildDir, '.icon_sizes_tmp');
  fs.mkdirSync(tempSizesDir, { recursive: true });

  const sizes = [16, 32, 64, 128, 256, 512];
  const sizeMap = { 1024: fs.readFileSync(iconPngPath) };

  for (const sz of sizes) {
    const outPath = path.join(tempSizesDir, `icon_${sz}.png`);
    execSync(`sips -z ${sz} ${sz} "${iconPngPath}" --out "${outPath}" > /dev/null`);
    sizeMap[sz] = fs.readFileSync(outPath);
  }

  // Clean up temporary size files
  fs.rmSync(tempSizesDir, { recursive: true, force: true });

  console.log('Assembling macOS .icns container...');
  const icnsBuf = buildIcns({
    icp4: sizeMap[16],
    ic11: sizeMap[32],
    icp5: sizeMap[32],
    ic12: sizeMap[64],
    icp6: sizeMap[64],
    ic07: sizeMap[128],
    ic13: sizeMap[256],
    ic08: sizeMap[256],
    ic14: sizeMap[512],
    ic09: sizeMap[512],
    ic10: sizeMap[1024],
  });

  fs.writeFileSync(iconIcnsPath, icnsBuf);
  console.log(`Saved macOS icon: ${iconIcnsPath} (${icnsBuf.length} bytes)`);
}

if (require.main === module) {
  main();
}

module.exports = { renderMaster1024, buildIcns };
