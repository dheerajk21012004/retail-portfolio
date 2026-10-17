// Turns each original in photos/ into exactly one web image in public/looks/<name>.jpg:
// bakes in EXIF rotation, strips ALL metadata (EXIF, GPS, ICC) and caps the long edge at 1600px.
// Records sizes + a placeholder colour in src/photos.json.
// New photos get a placeholder entry appended to looks.json. Run: npm run photos
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'photos';
const OUT = 'public/looks';

const looks = JSON.parse(fs.readFileSync('looks.json', 'utf8'));
const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|avif|tiff?)$/i.test(f));

for (const f of files) {
  if (!looks.some((l) => l.photo === f)) {
    looks.push({ photo: f, name: 'New look', pieces: 'Write the key pieces here', colour: 'Colour and fabric', why: 'One line on why it works.', alt: '' });
    console.log(`added ${f} to looks.json, give it a name and notes`);
  }
}
fs.writeFileSync('looks.json', JSON.stringify(looks, null, 2) + '\n');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const { photo } of looks) {
  const src = path.join(SRC, photo);
  if (!fs.existsSync(src)) {
    console.warn(`photos/${photo} is listed in looks.json but missing, skipped`);
    continue;
  }
  const id = path.parse(photo).name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // sharp drops all metadata unless asked to keep it; rotate() applies EXIF orientation first.
  const { width, height } = await sharp(src)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/${id}.jpg`);
  const [r, g, b] = (await sharp(src).stats()).channels.map((c) => Math.round(c.mean));
  manifest[photo] = { id, w: width, h: height, color: `rgb(${r},${g},${b})` };
}

// Self check: one image per photo, and nothing we publish may carry metadata.
const published = fs.readdirSync(OUT);
if (published.length !== Object.keys(manifest).length) throw new Error(`${published.length} files for ${Object.keys(manifest).length} photos`);
for (const f of published) {
  const m = await sharp(`${OUT}/${f}`).metadata();
  if (m.exif || m.xmp || m.iptc || m.icc) throw new Error(`metadata left in ${f}`);
}

fs.writeFileSync('src/photos.json', JSON.stringify(manifest, null, 2) + '\n');
const kb = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(`${OUT}/${f}`).size, 0) / 1024;
console.log(`${Object.keys(manifest).length} looks processed, ${kb.toFixed(0)} KB in ${OUT}, metadata clean`);
