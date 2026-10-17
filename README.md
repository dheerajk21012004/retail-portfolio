# The Atelier

Dheeraj Kodwani's lookbook site: a 3D tailor's atelier on laptops, a swipeable lookbook on phones,
and a calm, still version for anyone who prefers reduced motion.

Live: https://dheerajk21012004.github.io/retail-portfolio/

## Editing the looks

Everything on the rail comes from `looks.json`. Its order is the order on the rail.

```json
{
  "photo": "suit.jpg",
  "name": "The Chocolate Double Breasted",
  "pieces": "A double breasted chocolate suit, white shirt ...",
  "colour": "Chocolate wool with crisp white ...",
  "why": "One line on why it works.",
  "alt": ""
}
```

Leave `alt` empty and the page describes the photo as "Dheeraj wearing" plus `pieces`.
Fill it in for photos where that would read oddly, such as group shots.

## Adding or swapping photos

1. Drop the original into `photos/`. That folder never leaves your machine because it still holds EXIF and GPS data.
2. `npm run photos` strips all metadata, fixes rotation, writes exactly one JPEG per photo (1600px max) into `public/looks/`, and adds a placeholder entry to `looks.json` for any new photo.
3. `npm run og` redraws the link preview from the first look (needs Chrome or Edge).
4. Commit and push to `main`. GitHub Actions builds and deploys in a minute or two.

To remove a look, delete its entry from `looks.json`.

## Running it locally

```
npm install
npm run dev
```

Add `?motion=off` to the URL for the calm version, or `?motion=on` to force motion when your system asks for reduced motion.
