# Brief for ChatGPT: writing cards for Lumen

You are being asked to help grow the content of an app called Lumen. This brief explains what the app is, exactly what a card is, how big everything must be, how to write cards that are good enough to ship, how to make their pictures, and how to hand your work back.

- **Repository:** https://github.com/CuriousCoderAgent/intelligence-app
- **Live app:** https://intelligence-app-nine.vercel.app (open it on a phone, or in a narrow browser window, and swipe through twenty cards before you write any)
- **Files to read in the repository:** this file, `AGENTS.md` (the short rulebook), `content/pack.schema.json` (the exact card format), and `docs/CARD_INDEX.md` (every card that already exists)

If this brief and the repository ever disagree, `content/pack.schema.json` and `AGENTS.md` win, because the build enforces them.

---

## 1. What Lumen is

Lumen is a phone app for one person's spare minutes. Its owner built it to replace scrolling Instagram and X with something that leaves him knowing more. He may open it to the public later.

It works like a short-video feed, except every screen is one fact:

- The whole screen is one card. Swiping up moves to the next card, exactly one card per swipe.
- A card is a picture on the top half and a short piece of text on the bottom half.
- Cards the reader has not seen come first, with topics mixed so two cards on the same topic are not neighbours.
- After every ten new cards the app shows a pause screen suggesting the reader stop. When the deck runs out, it ends. The app is designed to be put down.
- There are no accounts, no comments, no likes and no advertising. The reader can save a card, share it, and choose which topics to see.

The app is only as good as its cards. The owner wants a very large deck: thousands of cards, each one worth the swipe. That is the job.

### Who is reading

A curious adult in India, reading in English, with a few minutes to spare. Assume they are intelligent and not a specialist in the topic. They want to feel that the time was well spent: "I did not know that, and I am glad I do now."

### What a card must do

In about fifteen seconds of reading, a card must:

1. Catch attention with a title that is surprising and literally true.
2. Deliver one specific fact, with its real numbers, names and dates.
3. Say why that fact matters or how to use it.
4. Name where it comes from, so the reader can trust it.

---

## 2. What a card looks like, and its dimensions

A card fills a phone screen in portrait. The app is designed for screens from 360 x 640 up to 430 x 932 CSS pixels. From top to bottom a card has:

| Part | What it is | Size on screen |
| --- | --- | --- |
| Picture | An illustration, or generated line art if no picture exists yet | Full width, roughly the top 45 to 55% of the screen |
| Topic label | For example SCIENCE, in the topic's accent colour | One small line |
| Title | The hook, in a large serif face | Two to four lines |
| Body | The fact | Four to seven lines |
| Takeaway | Why it matters, in italics under a thin rule | One to three lines |
| Source and buttons | The source on the left, save and share on the right | One or two small lines |

The text must fit on the smallest phone **without scrolling**. That is the reason for the character limits below. They are hard limits: a card that breaks one is rejected by the build.

### The six fields of a card

| Field | Purpose | Characters (including spaces) |
| --- | --- | --- |
| `id` | Permanent unique name. Also the picture's file name. | at most 48 |
| `title` | The hook | 12 to 80 |
| `body` | The fact itself | 80 to 320 |
| `takeaway` | Why it matters or how to use it | 20 to 150 |
| `source` | Who says so, and when | 4 to 110 |
| `visual` | A description of the picture, used to generate it | 20 to 220 |

Aim for the middle of each range. A typical good card has a title of 35 to 60 characters, a body of 180 to 280, and a takeaway of 60 to 120.

A finished card, as it is stored:

```json
{
  "id": "sci-banana-radiation",
  "title": "Bananas are radioactive",
  "body": "Bananas are rich in potassium, and a tiny share of all potassium is the radioactive isotope potassium-40. One banana delivers about 0.1 microsieverts. A chest X-ray is roughly a thousand bananas.",
  "takeaway": "Radiation is a matter of dose. Your body holds its potassium level steady, so bananas never add up.",
  "source": "US Environmental Protection Agency; Health Physics Society",
  "visual": "a single banana glowing softly on a dark laboratory bench with faint rings of energy radiating outward"
}
```

---

## 3. How to write each field

### `title`: the hook

- It must be **literally true on its own**. Many readers will see only the title. If the title alone would mislead them, rewrite it.
- State the surprising thing directly. Good: "Sharks are older than trees". Weak: "An amazing fact about sharks".
- No clickbait ("You won't believe..."), no questions used as bait, no exclamation marks.
- Sentence case, no full stop at the end unless the title is two sentences.

### `body`: the fact

- Two or three plain sentences.
- Put in the specifics: the number with its unit, the person's name, the year, the place. "About 66 days, with a range from 18 to 254" is better than "a couple of months".
- One idea only. If you want to write "also", you have a second card.
- Give the mechanism or the evidence when there is room: how do we know, or why is it so?
- If the fact is an estimate, say so ("an estimated", "about"). If experts dispute it, say that too.

### `takeaway`: why it matters

- It must add something the body did not say: an implication, a practical use, a wider principle, or a memorable consequence.
- Do not restate the body in other words, and do not moralise.
- For self-development and economics cards, a concrete action works well ("Ask how long similar tasks took last time, then trust that number over your gut.").
- For history, science and geography cards, a consequence or a change of perspective works well ("Ancient Egypt lasted so long that it had its own ancient history.").

### `source`: who says so

- Name the origin: author or institution, publication, year. Examples: "Lally et al., European Journal of Social Psychology (2010)", "NASA Jet Propulsion Laboratory", "Election Commission of India (2024)".
- Prefer the primary source (the study, the agency, the original book) over a news article or an encyclopaedia.
- No URLs. No "Wikipedia". No "various sources".
- Only cite a source you have actually checked says this. Never invent a citation. If you cannot find a real source, do not write the card.

### `visual`: the picture description

- One noun phrase describing a concrete scene that a painter could paint, for example "a lone spacecraft with a large dish antenna drifting through deep darkness, the Sun only a bright star far behind it".
- Choose one clear subject. It should make sense at a glance on a small screen.
- Do not ask for text, letters, numbers, labels, logos, charts with figures, or the likeness of a real living person. Image models render text badly and the card already has its text.
- Do not put style words here (no "digital art", "cinematic"). The style and colours are added automatically so that all cards match.

### `id`: the permanent name

- Format: the topic id, a hyphen, then a short slug of lowercase words joined by hyphens. Examples: `hist-salt-march`, `math-kaprekar-6174`, `geo-lake-baikal`.
- Lowercase letters, digits and hyphens only. It must start with the id of the topic folder it sits in.
- It must be unique in the whole deck.
- It is **permanent**. The reader's phone uses it to remember which cards were read and saved. Never change an id that has been merged, never reuse one for a different fact, and never delete a card. Correcting a card's wording or a factual error is fine.
- The first 120 cards have numbered ids such as `sci-01`. Leave them. New cards use descriptive slugs.

---

## 4. The quality bar

A card is good enough to ship only if every answer is yes:

1. **Is it true?** You checked the numbers, names and dates against a primary or reputable source, and that source is the one named.
2. **Is it one idea?** Exactly one fact, fully delivered.
3. **Would the reader care?** It is surprising, or useful, or changes how they see something. "Paris is the capital of France" is true and worthless.
4. **Is it specific?** Real figures and names, not "many", "a long time ago" or "scientists say".
5. **Will it still be true in five years?** Say "in 2024", not "last year". For a record that could be broken, give the date it was set.
6. **Is it new to the deck?** It is not in `docs/CARD_INDEX.md`, even under a different title.

### Things to avoid

- **Popular myths.** Do not repeat that we use 10% of our brains, that goldfish have three-second memories, that Einstein failed maths, that the tongue has taste zones, that lightning never strikes twice, or that Napoleon was short. A card that debunks a myth, with a source, is welcome.
- **Shaky science.** Much famous psychology did not replicate (power posing, ego depletion, the original marshmallow test claims, the Stanford prison experiment as usually told). Either skip these or write the card about the fact that the finding fell apart.
- **Partisan politics.** The Politics topic means civics: how elections, constitutions, institutions and political ideas work, and where they came from. No opinions about current parties, leaders or live controversies, in any country.
- **Advice on health, law or money.** Describe what a study found. Do not tell the reader what to eat, take, sign or buy.
- **Shock and gore.** No graphic violence, nothing sexual, nothing cruel. A teenager should be able to read every card.
- **Trivia with no point.** A fact needs a "so what". If you cannot write a takeaway that adds something, the fact is not a card.
- **Western default.** A healthy share of cards should be about India, Asia, Africa and Latin America. Use metric units. Explain anything a reader in India might not know.

### Accuracy procedure

For every card, before you write it:

1. Find the claim in a primary or reputable source (the paper, the agency's page, the original book, a major reference work).
2. Check each number, date and name in your draft against that source.
3. Check the claim is not a known myth or a disputed finding.
4. If you cannot do all three, drop the card. A smaller batch of solid cards is far better than a large batch with errors. One false card damages trust in all the others.

---

## 5. Style

- British spelling: colour, metre, organisation, civilisation.
- Short, direct sentences. Active voice. No jargon without an explanation.
- No exclamation marks, no emoji, no hashtags.
- Numbers: use digits for anything with a unit or over ten ("about 28 million tonnes", "23 people"). Use "about" or "roughly" where a figure is rounded.
- Dates as "30 April 1993" or "in 1947". Use BCE and CE.
- **Plain characters only.** The app's fonts contain Latin letters (including accented ones such as é, ö, ç), digits, and ordinary punctuation including the degree sign and curly quotes. They do **not** contain arrows, mathematical symbols such as the approximately sign or the square-root sign, superscript digits other than 2 and 3, emoji, or any non-Latin script. Write "about" in place of an approximately sign, "the square root of 2" in words, and transliterate names from other scripts into plain Latin letters (write "Ashoka", "Xuanzang", "sifr"). The build rejects cards containing unsupported characters.

---

## 6. Topics

There are twelve topics. A card belongs in exactly one. The id is the folder name and the start of every card id in it.

| Id | Topic | What belongs here | Colours (background / accent) |
| --- | --- | --- | --- |
| `self` | Self-Development | Research-backed findings on learning, habits, focus, sleep, decisions and motivation. Evidence, not slogans. | #3d1c0a / #ffa35c, burnt orange |
| `geo` | Geography | Places, borders, rivers, mountains, climate, maps, where people live | #07302f / #62e0d6, deep teal |
| `sci` | Science | Physics, chemistry, biology, earth science, medicine as science | #06293f / #72ccff, ocean blue |
| `space` | Space | Astronomy, planets, stars, spaceflight, cosmology | #0e0f33 / #ffd98a, indigo and gold |
| `pol` | Politics | Civics: elections, constitutions, institutions, political ideas and their history | #3d0f1a / #ff8f9f, crimson |
| `tech` | Technology | Computing, the internet, AI, devices, and the stories behind them | #22124a / #bda4ff, violet |
| `gk` | General Knowledge | Language, food, sport, culture, records, everyday things with hidden stories | #2e2a08 / #f4d84a, olive and mustard |
| `hist` | History | Events, people, civilisations and inventions, from all regions and eras | #33230e / #e9c07f, sepia |
| `soc` | Sociology | How people behave in groups: social psychology, demography, cities, culture | #35103a / #ee8cf2, plum |
| `math` | Maths | Numbers, probability, geometry, famous problems and the people behind them | #1b300c / #b9ea6b, moss green |
| `eng` | Engineering | Structures, machines, materials, transport, and how they were built | #0d2452 / #a9c6ff, blueprint blue |
| `econ` | Economics | Money, trade, markets, behavioural economics, development | #0b3021 / #5fe3a0, emerald |

Keep the deck balanced. When you add a batch, look at the card counts in `docs/CARD_INDEX.md` and add to the thinner topics first.

A new topic (for example Psychology, Health, Philosophy, Art or Nature) is possible: it is one entry in `content/topics.json`. `AGENTS.md` explains how. Propose it to the owner before adding one.

---

## 7. Do not repeat a card

`docs/CARD_INDEX.md` lists every card id and title, grouped by topic. Read the section for your topic before you write.

A card is a duplicate if it teaches the same fact, even with a different title or angle. "The Moon is drifting away" and "The Moon moves 3.8 cm farther each year" are the same card. A different fact about the same subject is fine: the deck can hold ten cards about the Moon as long as each teaches something different.

The build rejects two cards with the same id or the same title. It cannot detect the same fact reworded, so that check is yours. If you can run commands, `npm run qc` lists new cards that resemble existing ones.

Every night a quality-control run reads newly added cards closely, checks their facts against sources, and corrects or retires cards that fail. A card retired as a duplicate or as untrue is wasted work, so check first.

---

## 8. Where cards live, and the file format

Cards are stored in **packs**. A pack is one JSON file holding an array of up to 50 cards, all on one topic:

```
content/
  topics.json
  pack.schema.json
  sci/
    starter.json
    2026-12-oceans.json      <- a pack you add
  hist/
    starter.json
    ...
```

Rules:

- **Always create a new pack file.** Do not add cards to an existing pack. New files cannot conflict with other contributors' work, and unchanged packs stay cached on readers' phones.
- Path: `content/<topic id>/<pack name>.json`.
- Pack name: lowercase letters, digits and hyphens, ending in `.json`. Use the year and month plus a word or two, for example `2026-12-oceans.json` or `2026-12-chatgpt-1.json`.
- At most 50 cards in one pack. Start another file for more.
- The file is a JSON array. Each card is an object with exactly the six fields `id`, `title`, `body`, `takeaway`, `source`, `visual`. No other fields, no comments, no trailing commas.
- Inside a JSON string, write a double quote as `\"`.
- Every id in the pack starts with the folder's topic id.

A complete, valid pack with two cards:

```json
[
  {
    "id": "geo-lake-baikal",
    "title": "One lake holds a fifth of the world's unfrozen fresh water",
    "body": "Lake Baikal in Siberia is the deepest lake on Earth, reaching 1,642 metres. It holds about 23,600 cubic kilometres of water, roughly 20% of all the unfrozen fresh water on the planet's surface.",
    "takeaway": "It is also the oldest lake, about 25 million years old, which is why most of its species live nowhere else.",
    "source": "UNESCO World Heritage Centre; US Geological Survey",
    "visual": "a vast frozen lake with clear turquoise ice cracked into geometric plates, dark forested mountains on the far shore"
  },
  {
    "id": "geo-diomede-islands",
    "title": "Two islands 4 km apart are almost a day apart",
    "body": "Big Diomede belongs to Russia and Little Diomede to the United States. They sit about 3.8 km apart in the Bering Strait, with the International Date Line between them, so their clocks differ by up to 21 hours.",
    "takeaway": "From Little Diomede you can look across the water and see tomorrow.",
    "source": "US National Oceanic and Atmospheric Administration",
    "visual": "two small rocky islands facing each other across a narrow icy strait, one in daylight and one under a night sky"
  }
]
```

---

## 9. Pictures

Every card works without a picture: the app draws line art in the topic's colours. A real picture makes the card much better, and the owner wants one for every card eventually.

### Dimensions and file format

| | Requirement |
| --- | --- |
| Shape | Vertical portrait, aspect ratio 2:3 |
| Size to generate | 1024 x 1536 pixels |
| File type to hand over | PNG (JPEG and WebP are also accepted) |
| File name | The card id, exactly, plus the extension: `geo-lake-baikal.png` |
| Where it goes | The `image-inbox/` folder at the top of the repository |

A script (`npm run images`) then converts each file to WebP, 1080 pixels wide and at most 1620 high, usually 100 to 200 KB, and stores it at `src/assets/cards/<card id>.webp`. That WebP is what gets committed. Do not commit the large originals.

### Composition: where things must be in the frame

The app shows the picture across the full width of the card's top half, crops it to fit, lays its title bar over the top edge, and fades the lower part of the picture into the card's background colour so the text sits on a clean ground. So, measuring from the top of the 1024 x 1536 image:

| Band of the image | What happens to it | What to put there |
| --- | --- | --- |
| Top 20% (0 to about 300 px) | Partly cropped, and the app's name and buttons sit over it | Plain background only: sky, darkness, soft gradient |
| 20% to 50% (about 300 to 770 px) | Always fully visible | **The main subject, centred left to right** |
| 50% to 60% | Visible but starting to fade | The lower edge of the subject, or foreground |
| Bottom 40% (below about 920 px) | Fades out or is cropped | Dark, simple, no detail and nothing important |

Keep the subject away from the left and right edges too. Leave about 10% clear on each side.

### Style: one look for the whole deck

All pictures must look like one series. Use this wording for every picture, changing only the scene and the colours:

> Illustration of **[the card's `visual` text]**. Colour palette: **[the topic's palette words]**, on a dark background. Style: rich editorial illustration, painterly digital art with bold simplified shapes, dramatic cinematic lighting and a subtle film grain. No text, letters, numbers, logos, borders or watermarks anywhere in the image. Format: vertical 2:3 portrait, 1024 x 1536 pixels. Centre the main subject and place it about one third of the way down. Leave a little plain background above it. Keep the bottom 40% of the image dark, simple and free of detail, because it fades into a text panel.

The palette words for each topic:

| Topic | Palette words |
| --- | --- |
| `self` | burnt orange, ember and deep brown |
| `geo` | deep teal, sea green and sand |
| `sci` | deep ocean blue and bright cyan |
| `space` | midnight indigo with pale gold starlight |
| `pol` | deep crimson, oxblood and rose |
| `tech` | deep violet and electric lavender |
| `gk` | dark olive and mustard yellow |
| `hist` | sepia, umber and antique gold |
| `soc` | deep plum and magenta |
| `math` | dark moss green and lime |
| `eng` | blueprint blue and pale steel |
| `econ` | dark emerald and mint green |

`docs/IMAGE_PROMPTS.md` in the repository already contains this full prompt, filled in, for every card that still has no picture. You can work straight down that list.

### Picture rules

- No text of any kind in the image, including signs, book spines, screens and number plates.
- No real, identifiable living people. Historical figures may appear as a figure in period dress, without attempting a portrait likeness.
- No logos, brands, flags used as decoration, or copyrighted characters.
- Dark overall, with the topic's colours leading. A bright white or pastel image will clash with the card.
- One clear subject. It must read at the size of a playing card.

---

## 10. How to hand in your work

### If you can edit the repository (for example through a coding agent with GitHub access)

1. Read `AGENTS.md` and `docs/CARD_INDEX.md`.
2. Create a branch.
3. Add your new pack file or files under `content/<topic>/`.
4. Run `npm install` once, then `npm run sync`. This validates every card and refreshes `docs/CARD_INDEX.md` and `docs/IMAGE_PROMPTS.md`. Fix anything it reports and run it again until it says the deck is OK. Then run `npm run qc` and look at the possible duplicates it lists in `qc/report.md`: rewrite or drop any of your cards that repeats an existing one.
5. Run `npm run build` to confirm the app still builds.
6. Commit the pack files and the two refreshed files in `docs/`. Open a pull request against `main`. Do not push to `main` directly: `main` deploys to the live app.
7. In the pull request description, state how many cards you added to each topic.

A content pull request must contain only content: files under `content/`, the two generated files under `docs/`, and optionally pictures under `src/assets/cards/`. Do not change application code in the same pull request.

### If you cannot edit the repository (ordinary chat)

Reply with, for each pack:

1. The file path, for example `content/sci/2026-12-oceans.json`.
2. The complete file contents in one JSON code block, valid as it stands, so it can be saved without editing.

For pictures, generate each one from its prompt and name it after the card id. Say which card id each image belongs to.

Before writing, ask the owner for the current contents of `docs/CARD_INDEX.md`, or read it from the repository address above, so that you do not repeat existing cards.

---

## 11. Checklist before you submit a batch

For the batch:

- [ ] Every card is in a **new** pack file, in the right topic folder, with at most 50 cards per file.
- [ ] The file is valid JSON: an array of objects with exactly the six fields.
- [ ] No card repeats a fact already in `docs/CARD_INDEX.md` or elsewhere in your batch.
- [ ] The batch favours the topics with the fewest cards.
- [ ] `npm run sync` passes (if you can run it).

For each card:

- [ ] The id is `<topic>-<slug>`, lowercase, unique, and starts with its folder's topic id.
- [ ] The title is 12 to 80 characters and literally true on its own.
- [ ] The body is 80 to 320 characters, one idea, with real numbers, names and dates.
- [ ] The takeaway is 20 to 150 characters and adds something new.
- [ ] The source is a real, named source that you checked, with no URL.
- [ ] The visual is a concrete scene of 20 to 220 characters with no text or numbers in it.
- [ ] British spelling, plain characters only, no exclamation marks.
- [ ] It is not a myth, not a disputed finding stated as settled, not partisan, and not advice.

---

## 12. What never to do

- Do not change or reuse the id of an existing card, and do not delete cards.
- Do not edit an existing pack to add cards. Add a new file.
- Do not invent facts, figures or citations. If you are not sure, leave it out.
- Do not change application code, configuration or dependencies as part of adding content.
- Do not add accounts, tracking, advertising or calls to outside services to the app.
- Do not push directly to `main`.
