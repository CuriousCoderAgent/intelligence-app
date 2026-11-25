# Lumen

One idea per swipe. A full-screen feed of short, sourced facts across twelve topics, built to replace a scroll through social media with something you keep.

- 120 cards to start, built to grow to thousands: self-development, geography, science, space, politics, technology, general knowledge, history, sociology, maths, engineering and economics
- Swipe up for the next card, one card per swipe
- Unread cards come first; once you are caught up, old cards return oldest-first
- Pick topics, save cards, share a link to a card
- A pause after every ten new cards, and an end to the deck. It is meant to be put down
- Installs to the home screen and works offline (PWA)
- A page of your own reading: time spent, cards read, and the topics you turn out to like
- Like, save and share cards. The feed leans gently towards what you like
- No account needed, and no tracking. Without one, everything stays on the device
- Optional Google sign-in: progress follows you between devices, and you can be introduced to readers with similar tastes

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, also reachable from your phone on the same Wi-Fi
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Requires Node 22 or newer.

## Put it on your phone

The build in `dist/` is a static site, so any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Paths are relative, so it also works under a sub-path.

Once it is online, open the URL on your phone and choose **Add to Home Screen** (Safari: Share menu; Chrome: three-dot menu). It then opens full screen like an app and works offline.

## Add content

Cards are JSON files under `content/`, one folder per topic, and adding cards needs no code changes. **[AGENTS.md](AGENTS.md) is the full guide**: the card format, the quality bar, and how to add topics and pictures. It is written so that an AI assistant given this repository can add cards on its own. [docs/CHATGPT_BRIEF.md](docs/CHATGPT_BRIEF.md) is a longer, self-contained brief to hand to an assistant, and [docs/CARD_INDEX.md](docs/CARD_INDEX.md) lists every card in the deck.

The short version:

```bash
npm run list -- sci     # see what the science topic already has
# add a new file: content/sci/<pack-name>.json
npm run sync            # validate, refresh docs/CARD_INDEX.md and docs/IMAGE_PROMPTS.md
```

Every card has line art generated from its topic, so the app looks finished without any images. A card switches to a real picture as soon as `src/assets/cards/<card id>.webp` exists. `docs/IMAGE_PROMPTS.md` has a ready-to-paste prompt for each card that still needs one, and `npm run images` compresses what you save into `image-inbox/`.

## Built to grow

The deck can reach many thousands of cards without slowing the app:

- The app ships with only a small index of card ids. Card text is fetched in packs of up to 50, just before it is needed, and then cached for offline reading.
- The feed adds cards to the page in batches as you swipe.
- New content arrives as new files, so two contributors never edit the same file, and a deploy only downloads the packs that are new.
- A validator rejects malformed cards, duplicate ids, duplicate titles and characters the fonts cannot show before anything is deployed.
- A nightly quality-control run (`qc/NIGHTLY.md`) looks for reworded duplicates, reads new cards closely, checks their facts and logs what it changed in `qc/LOG.md`. `npm run qc` runs the automatic part on demand.

## Where things are

```
content/
  topics.json             topics, their colours and line-art style
  pack.schema.json        the card format and its limits
  <topic>/*.json          the cards, in packs
src/
  lib/deck.ts             card index and on-demand pack loading
  lib/feed.ts             card order: unread first, topics spread out, pauses
  lib/storage.ts          progress, saved cards and streak (localStorage)
  components/Feed.tsx     the swipe feed
  components/Card.tsx     one card
  components/CardArt.tsx  picture, or generated line art when there is none
  lib/insights.ts         what the reader likes, worked out on the device
  lib/api.ts              client for the server (sign-in, sync, people)
  components/YouPanel.tsx the reader's page: time, likes, links to the rest
  styles.css              all styling
server/                   accounts, sync, people matching (runs on Railway)
scripts/
  lib/deck.mjs            reads and validates content/ (shared by everything)
  lib/vite-deck.mjs       build plugin: card index, trimmed packs
  qc.mjs                  quality scan: likely duplicates, misfiled cards, style slips
  *.mjs                   check, list, image prompts, image optimiser
qc/
  NIGHTLY.md              what the nightly quality-control run does
  state.json              which pairs were ruled on, when each card was last read
  LOG.md                  what each run changed
```

The app name is set in three places: `APP_NAME` in `src/App.tsx`, the manifest in `vite.config.ts`, and `index.html`.

## The server and Google sign-in

Accounts, sync, people matching and feature requests are handled by a small API in `server/`, running on Railway with a Postgres database. The app finds it through `VITE_API_URL` in `.env.production`. Delete that line and the app builds with no accounts at all.

Sign-in stays switched off, and hidden in the app, until the server has a Google client id and secret. To switch it on:

1. In Google Cloud Console, create a project, then **APIs & Services > OAuth consent screen**: choose External, give the app a name and your email, and add the scopes `openid`, `email` and `profile`.
2. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**. Under **Authorised redirect URIs** add exactly `https://api-production-3ea7ab67.up.railway.app/auth/google/callback`.
3. In Railway, open the `lumen` project, the `api` service, **Variables**, and add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with the two values Google shows. Railway redeploys by itself.
4. While the consent screen is in Testing, only the Google accounts you list as test users can sign in. Press **Publish app** when you want anyone to be able to.

Feature requests land in the `feature_requests` table of the Railway database (Railway > `lumen` > Postgres > Data).

## Before making it public

- Re-verify facts against primary sources. Every card names its source, but the starter deck was written in one pass and has not been independently fact-checked. The same goes for cards added by any AI assistant.
- Check the usage terms of the image tool for commercial use of generated pictures.
- Write a short privacy policy page and link it from the Google consent screen. The app's own privacy page (You > Your data and privacy) says what is stored; Google asks for a public address.
- People matching shows a name, photo and top topics to other opted-in readers. Before strangers use it, add a way to block or report someone.
