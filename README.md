# Lumen

One idea per swipe. A full-screen feed of short, sourced facts across twelve topics, built to replace a scroll through social media with something you keep.

- 120 cards to start: self-development, geography, science, space, politics, technology, general knowledge, history, sociology, maths, engineering and economics
- Swipe up for the next card, one card per swipe
- Unread cards come first; once you are caught up, old cards return oldest-first
- Pick topics, save cards, share a link to a card
- A pause after every ten new cards, and an end to the deck. It is meant to be put down
- Installs to the home screen and works offline (PWA)
- No account, no server, no tracking. Progress is stored on the device

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, also reachable from your phone on the same Wi-Fi
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Requires Node 22.18 or newer.

## Put it on your phone

The build in `dist/` is a static site, so any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Paths are relative, so it also works under a sub-path.

Once it is online, open the URL on your phone and choose **Add to Home Screen** (Safari: Share menu; Chrome: three-dot menu). It then opens full screen like an app and works offline.

## Add pictures

Every card has line art generated from its topic, so the app looks finished without any images. A card switches to a real picture as soon as a file named after its id exists in `src/assets/cards/`.

1. `npm run prompts` writes `docs/IMAGE_PROMPTS.md`: one ready-to-paste prompt per card that still needs a picture, in a shared style and in each topic's colours.
2. Generate the image in ChatGPT and save it into `image-inbox/` as `<card id>.png`, for example `sci-03.png`.
3. `npm run images` resizes and compresses everything in the inbox to WebP in `src/assets/cards/` (a 2 MB PNG becomes roughly 100 to 200 KB).
4. Commit the new files in `src/assets/cards/` and redeploy.

Pictures can be added a few at a time. To change the look of the whole series, edit `STYLE` in `scripts/export-image-prompts.mjs`. To change one picture, edit that fact's `visual` line.

## Add or edit facts

Facts live in `src/data/facts/`, one file per topic. Each fact is:

```ts
{
  title: 'Bananas are radioactive',          // the hook
  body: 'Two or three sentences with the fact itself.',
  takeaway: 'Why it matters, or how to use it.',
  source: 'Who says so, and when',
  visual: 'a scene description for the illustration',
}
```

Ids come from position in the file (`sci-03` is the third science fact), and ids are also image names and saved-card keys. So **add new facts at the end of a file** and do not reorder or delete existing ones.

`npm run check` validates the deck (missing fields, duplicates, text too long for a small phone). It also runs before every build.

To add a topic: add it to `CategoryId` in `src/types.ts` and to `src/data/categories.ts`, create its facts file, register it in `src/data/index.ts`, and add a motif for it in `src/components/CardArt.tsx`.

## Where things are

```
src/
  data/categories.ts      topics and their colours
  data/facts/*.ts         the cards
  lib/feed.ts             card order: unread first, topics spread out, pauses
  lib/storage.ts          progress, saved cards and streak (localStorage)
  components/Feed.tsx     the swipe feed
  components/Card.tsx     one card
  components/CardArt.tsx  picture, or generated line art when there is none
  styles.css              all styling
scripts/                  deck check, image prompts, image optimiser
```

The app name is set in three places: `APP_NAME` in `src/App.tsx`, the manifest in `vite.config.ts`, and `index.html`.

## Before making it public

- Re-verify facts against primary sources. Every card names its source, but the deck was written in one pass and has not been independently fact-checked.
- Check the usage terms of the image tool for commercial use of generated pictures.
- Progress lives only on each device. Accounts or sync across devices would need a backend.
