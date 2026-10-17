// Renders the link preview card (public/og.jpg, 1200x630) with headless Chrome or Edge,
// using the first look in looks.json. Run after npm run photos: npm run og
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const browser = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && fs.existsSync(p));
if (!browser) throw new Error('No Chrome or Edge found, set CHROME=/path/to/chrome');

const b64 = (file) => fs.readFileSync(file).toString('base64');
const font = (style) => b64(`node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-opsz-${style}.woff2`);
const looks = JSON.parse(fs.readFileSync('looks.json', 'utf8'));
const cover = JSON.parse(fs.readFileSync('src/photos.json', 'utf8'))[looks[0].photo];
const photo = b64(`public/looks/${cover.id}.jpg`);

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: B; src: url(data:font/woff2;base64,${font('normal')}) format('woff2'); font-weight: 400 900; }
@font-face { font-family: B; src: url(data:font/woff2;base64,${font('italic')}) format('woff2'); font-weight: 400 900; font-style: italic; }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { position: relative; font-family: B, serif; color: #efe5d3;
  background: radial-gradient(ellipse 60% 85% at 76% 45%, #3d2818, #120d0a 72%); }
body::after { content: ''; position: absolute; inset: 20px; border: 1.5px dashed rgb(201 163 95 / .35); }
.text { position: absolute; left: 86px; top: 0; bottom: 0; width: 640px; display: flex; flex-direction: column; justify-content: center; }
.eyebrow { font-size: 17px; font-weight: 600; letter-spacing: .5em; text-transform: uppercase; color: #c9a35f; margin-bottom: 30px; }
h1 { margin: 0; font-size: 124px; line-height: .86; font-weight: 500; letter-spacing: -.01em; }
h1 em { display: block; font-weight: 400; }
.line { margin-top: 36px; font-size: 36px; font-style: italic; }
.role { margin-top: 26px; font-size: 15px; font-weight: 600; letter-spacing: .4em; text-transform: uppercase; color: #c9a35f; }
.frame { position: absolute; right: 96px; top: 92px; width: 318px; }
.frame img { display: block; width: 100%; aspect-ratio: ${cover.w} / ${cover.h}; object-fit: cover; box-shadow: 0 30px 50px -18px #000; }
.frame svg { position: absolute; left: 50%; top: -46px; width: 200px; margin-left: -100px; }
</style>
<div class="text">
  <div class="eyebrow">The Atelier</div>
  <h1>Dheeraj <em>Kodwani</em></h1>
  <div class="line">Style is how I say hello.</div>
  <div class="role">Menswear Consultant</div>
</div>
<div class="frame">
  <svg viewBox="0 0 144 46"><path d="M72 22V12c0-7 10-8 10-1" fill="none" stroke="#c9a35f" stroke-width="2.4" stroke-linecap="round"/><path d="M6 44Q40 26 72 22Q104 26 138 44" fill="none" stroke="#7a5030" stroke-width="5.5" stroke-linecap="round"/></svg>
  <img src="data:image/jpeg;base64,${photo}" alt="">
</div>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const page = path.join(dir, 'og.html');
const png = path.join(dir, 'og.png');
fs.writeFileSync(page, html);
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=3000', `--screenshot=${png}`, pathToFileURL(page).href], { stdio: 'ignore' });
await sharp(png).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile('public/og.jpg');
fs.rmSync(dir, { recursive: true, force: true });
console.log('public/og.jpg written');
