# Guide for contributors (human or AI)

Lumen is a swipeable feed of short, sourced fact cards. Most contributions are **new cards**, and adding cards needs no code changes: cards are JSON files under `content/`.

Read this file before adding content. `npm run check` enforces most of it and must pass. `docs/CHATGPT_BRIEF.md` is the long version, with worked examples, the on-screen dimensions and the picture specification.

## Add cards

1. See what already exists so you do not repeat it. `docs/CARD_INDEX.md` lists every card id and title, or run:
   ```bash
   npm run list            # topics and card counts
   npm run list -- sci     # every id and title in one topic
   ```
2. Create a **new file** `content/<topic>/<pack-name>.json`. Do not append to an existing pack: new files never conflict with someone else's work, and unchanged packs stay cached on readers' phones.
   - `<topic>` is a topic id from `content/topics.json` (`sci`, `hist`, ...).
   - `<pack-name>` is lowercase letters, digits and hyphens, e.g. `2026-12-oceans.json`.
   - At most 50 cards per file.
3. Run `npm run sync`. It validates the deck and refreshes `docs/CARD_INDEX.md` and `docs/IMAGE_PROMPTS.md`. Commit your pack and both refreshed files.

A pack is a JSON array of cards:

```json
[
  {
    "id": "sci-banana-radiation",
    "title": "Bananas are radioactive",
    "body": "Bananas are rich in potassium, and a tiny share of all potassium is the radioactive isotope potassium-40. One banana delivers about 0.1 microsieverts. A chest X-ray is roughly a thousand bananas.",
    "takeaway": "Radiation is a matter of dose. Your body holds its potassium level steady, so bananas never add up.",
    "source": "US Environmental Protection Agency; Health Physics Society",
    "visual": "a single banana glowing softly on a dark laboratory bench with faint rings of energy radiating outward"
  }
]
```

| Field | What it is | Length |
| --- | --- | --- |
| `id` | Topic id, hyphen, short slug: `sci-banana-radiation`. Unique across the deck. | up to 48 |
| `title` | The hook. One line, literally true, makes sense on its own. | 12 to 80 |
| `body` | The fact in two or three plain sentences, with the specific numbers, names and dates. | 80 to 320 |
| `takeaway` | Why it matters or how to use it. Adds something; does not restate the body. | 20 to 150 |
| `source` | Who says so and when: author or institution, publication, year. No URLs. | 4 to 110 |
| `visual` | A concrete scene for the illustration, as a noun phrase. | 20 to 220 |

The exact rules are in `content/pack.schema.json`. The length limits exist so a card fits on a small phone without scrolling.

### Ids are permanent

An id is how a reader's phone remembers that a card was read or saved, and it is the image file name. Once a card is merged, never change its id, never reuse an id for a different fact, and do not delete cards. Fixing a card's wording or a factual error in place is fine and welcome.

A card that should no longer be shown, because it duplicates another or cannot be made true, is **retired**: add `{ "id": ..., "reason": ..., "replacedBy": ... }` to `content/retired.json`. It stays in its pack, its id stays reserved, and the app stops dealing it.

The first 120 cards use numbered ids (`sci-01`). New cards use descriptive slugs, which cannot collide when two people add cards at the same time.

## What makes a good card

The reader chose this over social media. Every card should leave them knowing one specific, true thing they did not know, and why it is worth knowing.

- **One idea per card.** If the body needs "also", it is two cards.
- **True, and checkable.** Verify every number, name and date against a primary or reputable source before writing it. Name that source. If you cannot find a source, do not write the card.
- **Assume no background.** The reader should be able to follow the card with nothing but the card. Do not lean on a story, a term or a debate they may never have heard of.
- **Avoid famous myths** (we use 10% of our brains, goldfish have three-second memories, the Great Wall is visible from space). A card that debunks a myth with a source is good, but it must first say what the myth is, in plain words, before saying why it is wrong.
- **Flag real disputes.** If a finding is contested or failed to replicate, say so in the body or takeaway, or skip it.
- **Surprising or useful.** "Paris is the capital of France" is true and worthless. Prefer facts that change how the reader sees something, or that they can apply.
- **Specific over vague.** "About 66 days, with a range of 18 to 254" beats "a couple of months".
- **Write things that stay true.** Prefer "in 2024" to "last year", and avoid records likely to be broken soon unless the card gives the date.
- **Politics means civics**: how institutions, elections and ideas work, and their history. No partisan claims, no opinions about current parties or politicians.
- **No medical, legal or financial advice.** Describe what a study found; do not tell the reader what to take or buy.
- **Global audience.** Metric units. Explain anything local. A healthy share of cards should be about India and the non-Western world, not only the US and Europe.

### Style

- British spelling (colour, metre, organisation).
- Plain, direct sentences. No exclamation marks, no clickbait ("You won't believe..."), no rhetorical filler.
- The title must be literally true on its own. A reader who sees only the title should not be misled.
- Say what is so, not what is not. "Old windows are thicker at the bottom, but the glass never flowed" is clear. "Old windows are not thicker at the bottom because glass flows" makes the reader untangle a negative.
- Plain text only: Latin letters, digits and ordinary punctuation. No emoji, arrows, maths symbols, superscripts or non-Latin scripts, because the app's fonts do not include them. Write "about" in place of an approximately sign, and transliterate other scripts.
- `visual` describes a scene to paint, in the style "a lone spacecraft drifting through deep darkness, the Sun only a bright star behind it". It must not ask for text, letters, numbers, logos, maps with labels, or the likeness of a living person.

## Add a topic

Add an entry to `content/topics.json` and at least one pack in `content/<id>/`:

```json
{ "id": "psych", "name": "Psychology", "ground": "#2a1238", "accent": "#d7a6ff", "palette": "deep purple and soft lilac", "motif": "network" }
```

- `id`: lowercase letters only. Permanent, like card ids.
- `ground`: a deep, dark background colour. `accent`: a bright tint of a related hue that is readable on it. Pick a hue that is clearly different from the existing topics.
- `palette`: the same colours in words, for image prompts.
- `motif`: the line art drawn on cards that have no picture. One of `steps`, `contours`, `orbits`, `planet`, `chamber`, `circuit`, `tiles`, `arches`, `network`, `spiro`, `bridge`, `bars`. A new motif is a code change in `src/components/CardArt.tsx` and `scripts/lib/deck.mjs`.

## Add pictures

Optional. A card without a picture shows generated line art.

1. `docs/IMAGE_PROMPTS.md` has one prompt per picture-less card.
2. Generate each image as a 1024 x 1536 portrait and save it as `image-inbox/<card id>.png`. `docs/CHATGPT_BRIEF.md` explains where the subject must sit in the frame.
3. `npm run images` converts them to WebP in `src/assets/cards/`. Commit those.

## Commands

| Command | What it does |
| --- | --- |
| `npm run sync` | Validates `content/` and refreshes the card index and image prompts. Run after adding cards. |
| `npm run check` | Validates `content/` only. Runs before every build. |
| `npm run list [-- topic]` | Shows what is already in the deck. |
| `npm run qc` | Scans the deck for likely duplicates, misfiled cards and style slips. Writes `qc/report.md`. |
| `npm run images` | Optimises pictures from `image-inbox/`. |
| `npm run dev` | Runs the app locally. Content edits reload the page. |
| `npm run build` | Check, type-check and production build. This is what the host runs. |

## Quality control

A scheduled session checks the deck every night, following `qc/NIGHTLY.md`. It rules on likely duplicates, reads new cards closely, verifies their facts, corrects or retires what fails, and records what it did in `qc/LOG.md`. Run `npm run qc` yourself before submitting a batch: it will tell you if a new card looks like an existing one.

## How the app uses content

- `scripts/lib/deck.mjs` reads and validates `content/`. The build, the check and the image scripts all use it.
- At build time `scripts/lib/vite-deck.mjs` produces a small index of every card id and its topic. The app ships with that index only, which is enough to order the feed and count unread cards.
- Card text is loaded one pack at a time, when a card from that pack is about to appear (`src/lib/deck.ts`), and then cached for offline use.
- The feed puts unread cards first, spreads topics apart, and adds elements to the page in batches (`src/lib/feed.ts`, `src/components/Feed.tsx`).

This keeps startup fast however large the deck grows. It was tested with 6,000 cards.

## Working on the code

- A pull request that adds content should not also change app code, and the reverse.
- `main` is deployed automatically. Open a pull request; do not push to `main` directly.
- Reader progress is stored on the device under the key `lumen.v1` (`src/lib/storage.ts`). Changing its shape needs a migration, or readers lose their history.
- Keep the app free of accounts, trackers and third-party network requests unless the owner asks for them.
