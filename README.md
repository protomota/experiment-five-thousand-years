# Five Thousand Years

An interactive atlas of world history, from 3000 BCE through November 8, 2026. Explore 826 milestones on a Three.js globe, navigate a focus timeline, filter 12 themes, and open sourced stories without leaving the site.

**[Explore the atlas](https://protomota.com/experiments/five-thousand-years)** · **[Protomota experiments](https://protomota.com/experiments)**

## Run locally

Requires Node.js 22.18 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3007. By default the app uses the published, versioned R2 assets. No credentials or database are needed to run or build the website.

```sh
npm run check
npm run build
```

The static build is written to `dist/`. Deploy that directory to a static web host. Protomota serves its HTML entry pages under `/experiments/five-thousand-years`; its release JavaScript, styles, images, fonts, readings and map outlines are served from R2.

## Features

- A globe with historical territory overlays, labeled modern urban footprints, and explicit site-vicinity markers where no suitable boundary exists.
- Touch rotation and pinch zoom, smooth camera travel, and direct movement to destinations already visible on the globe.
- A milestone-spaced timeline, era and theme filters, search, and adjustable playback speed.
- Brief cards and separately loaded readings. Of 826 readings, 774 contain at least 900 words; some available source articles are shorter.
- All 47 numbered U.S. presidencies, representing 45 individuals, with portraits and term information.
- Responsive mobile layout, full story navigation, and an editable 14-second HyperFrames prologue.

The catalog is curated, not exhaustive. Ancient dates and reconstructed boundaries may be approximate. A marker sometimes represents a region or representative site. Historical images may depict surviving monuments, objects, or later interpretations. BCE and CE use the familiar year numbering without religious era labels.

## Source layout

- `src/main.ts`, `src/style.css`: application interface and responsive layout.
- `src/events.ts`, `src/stories.ts`, `public/assets/*.json`: milestone catalog and brief editorial context.
- `src/globe.ts`, `src/globe-flight.ts`, `src/globe-touch.ts`: rendering, travel and gestures.
- `src/timeline.ts`: timeline spacing, focus and playback.
- `src/reading.ts`, `src/map-detail.ts`: on-demand readings and map detail.
- `src/film.ts`, `video/index.html`: HyperFrames prologue source.
- `scripts/`: checks, catalog curation, asset preparation and immutable R2 publishing tools.

## Assets and hosting

The published release `20261108-atlas-01` contains 2,133 R2 objects totaling **80.36 MB**. These are loaded as needed, not all on first visit:

| Asset group | Compressed size / count |
| --- | --- |
| Application JavaScript and CSS | 467 KB |
| Detailed readings | 3.08 MB |
| Map outlines and index | 2.63 MB |
| Cached photographs and portraits | 459 distinct WebP files, about 70.1 MB |
| Remaining image records | 299 licensed remote fallbacks; 49 explicit placeholders |

NASA GIBS detail tiles load directly from NASA. The main source catalog is committed; binary media, downloaded research, source caches, renders, credentials and local deployment configuration are excluded.

Build configuration uses environment variables (set them in your shell or deployment environment):

- `ATLAS_ASSET_BASE`: alternative asset URL prefix, ending in `/`.
- `ATLAS_CDN_BASE`: immutable release prefix when publishing application bundles to a CDN.
- `ATLAS_PAGE_BASE`: HTML route prefix, ending in `/`; default `/`.
- `ATLAS_OUTPUT_DIR`, `ATLAS_CACHE_DIR`: optional output/cache directories.
- `ATLAS_WORK_DIR`: working directory for data-generation and publishing scripts; defaults to `.atlas-work`.

The maintenance scripts require prepared source datasets and media under `ATLAS_WORK_DIR/assets`, and some download additional Wikimedia, Wikidata, Natural Earth or Cliopatria material. They are not part of a normal build. `npm run check:data` verifies a complete prepared asset cache. To rebuild the prologue, prepare those source assets and run `npm run video:build`.

Publishing scripts require `sharp` and `@aws-sdk/client-s3` installed in `$ATLAS_WORK_DIR/publish-tools`. `scripts/upload-release.mjs` reads `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` from the environment. Never commit credentials. Release uploads refuse to replace an object with different content.

## Credits and reuse

Built by [Brad Dunlap / Protomota](https://protomota.com). Inspired by [Joshua Barzon's post sharing a world-history timeline](https://x.com/JoshuaBarzon/status/2119199745583591641) and our [Everything We've Ever Launched](https://protomota.com/experiments/everything-launched) experiment.

Read [CREDITS.md](CREDITS.md) before reusing text, data or media. The public source repository does not change the separate licenses of third-party material. Source code is published for inspection; no additional blanket software license is granted by this repository.
