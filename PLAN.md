# PLAN.md — Binding of Isaac Completion Marks Tracker

> A single-page web app that reproduces the *Binding of Isaac: Repentance* completion‑marks grid
> (the layout shown in `image.png`) as a **real, interactive tracker**. Click any cell to record
> whether you have that character's completion mark for that boss, on Normal or Hard mode. All
> selections persist in `localStorage`.

This document is written for an **AI coding agent** that will implement the app end to end. Read the
whole thing before writing code. It contains the domain background, the exact data, the image-asset
strategy, the UI/interaction spec, the persistence schema, an ordered build plan, and a verification
checklist.

---

## 1. Goal & hard constraints (read these first)

Build a website that lets the user **track their Binding of Isaac completion marks** while keeping
the reference chart's **unlock guide** intact. The reference `image.png` is a grid of **characters
(columns) × bosses/challenges (rows)**; each cell shows what that character unlocks for that boss.
Our app keeps that guide (unlock sprite + quality color per cell) **and** makes every cell an
interactive tri-state toggle for the user's own progress — with a **Completion Mark Mode** toggle to
switch cells to the in-game mark icons.

The user was emphatic about the following — treat them as non‑negotiable requirements:

1. **ACTUALLY BUILD THE SITE.** Real DOM elements, real logic. Do **not** ship the reference image
   with invisible click regions layered on top. Every cell is a genuine, independently styled,
   independently clickable element generated from data.
2. **Make it interactive.** Clicking a cell changes its state and re-renders it. No read-only chart.
3. **Persist to `localStorage`.** Selections survive a page reload and browser restart.
4. **Keep the unlock guide visible.** Cells show the unlock item sprites (color-coded by quality),
   with a toggle to a completion-mark view.
5. **Scrape images once from the wiki** (`https://bindingofisaacrebirth.wiki.gg/images/`) into a
   local, committed `assets/` bundle — the app's single source of truth. The running app never
   contacts the wiki (see §5).
6. **Do not shortcut.** Generate the full roster of characters, the full set of marks, and the full
   unlock matrix; don't stub a handful and call it done.

Deliverable: a working app the user can run and use. Recommended stack is **SolidJS + Vite +
TypeScript** (see §4): `npm run dev` for development, `npm run build` for a self-contained static
`dist/` to open or serve.

---

## 2. Domain background (so the grid makes sense)

In *The Binding of Isaac*, every playable character has a **completion marks** page. A completion
mark is earned by defeating a specific major boss / clearing a specific challenge **with that
character**. Each mark has three meaningful states for a tracker:

- **Not earned** — you haven't beaten that boss with that character.
- **Normal mode** — beaten on Normal difficulty. In‑game the mark icon is drawn **solid black**.
- **Hard mode** — beaten on Hard difficulty. In‑game the mark icon is **outlined/tinted red**.
  Hard mode counts as also having Normal (it's the "higher" state).

There are **13 tracked marks** (the rows in `image.png`, ignoring the meta "All Marks" summary row).
Some marks are **mutually exclusive within a single run** (you physically can't get both in one run,
so they take separate runs): **Satan/The Lamb vs. Isaac/??? ** share the same run branch point, and
**Mother vs. The Beast** cannot both be fought in one run. This does **not** restrict what the
tracker allows — the user can mark anything — it's just context; optionally surface it as a note.

There are **34 playable characters**: 17 "untainted" (base) characters and their 17 "Tainted"
counterparts (added in the Repentance DLC).

Sources used to compile this plan:
- Completion Marks — https://bindingofisaacrebirth.wiki.gg/wiki/Completion_Marks
- Category: Completion mark icons — https://bindingofisaacrebirth.wiki.gg/wiki/Category:Completion_mark_icons
- Characters — https://bindingofisaacrebirth.wiki.gg/wiki/Characters

---

## 3. What the reference image shows (and how our app differs)

`image.png` is a community "unlock chart": each cell shows the **item** a character unlocks for
beating a boss, color‑coded by item quality/type (the KEY in the top‑right: Quality 0–4, Trinket,
Co‑op Baby, Character, Game Feature, Consumables). It also has "NO UNLOCK" mega‑cells and extra
rows (Ultra Greedier, All Marks) that don't apply to every character.

**Our app keeps that guide value AND adds tracking.** We do two things at once:

- **Reference layer (from the chart):** each cell shows the **unlock item sprite** that
  character earns for beating that boss, on a **quality/type‑colored background** exactly like the
  reference. This is the helpful "what do I get?" guide the chart provides. Preserve the KEY as a
  legend.
- **Tracking layer (new):** every cell is *also* a **tri‑state completion toggle** (none / normal /
  hard) recording *your* progress. Your state is drawn as a treatment on top of the unlock sprite
  (dimmed when not earned, highlighted for Normal, red‑outlined for Hard).

So each cell answers both "what does this unlock?" and "have I done it?" at a glance.

- Keep the **same grid orientation**: characters across the top, bosses down the left.
- **Row headers (left column) show the boss image** (like the reference), plus the boss name.
- A **"Completion Mark Mode" toggle** (see §7) swaps the cell contents from the *unlock item sprite*
  to the boss's *completion‑mark icon* (empty / solid‑black / red‑outlined by state), giving a clean
  view that mirrors the in‑game completion‑marks page. Toggling back returns to the unlock/guide view.
- **"NO UNLOCK" cells still track completion.** In the game every character has all marks even when a
  boss grants them no new item; those cells simply show no unlock sprite (neutral background) but
  remain fully clickable tri‑state toggles.

---

## 4. Recommended tech stack & project structure

**Stack:** **SolidJS + Vite + TypeScript.** Solid is a tiny (~7 KB) fine-grained reactive framework
whose model fits this app well:

- **Fine-grained reactivity:** a `createStore` for the completion state means toggling one cell
  updates *only that cell's* DOM — no virtual-DOM diffing, no manual `re-render this one cell` code.
  This directly replaces the hand-rolled per-cell update logic the vanilla plan needed.
- **Declarative, data-driven grid:** `<For each={CHARACTERS}>` / `<For each={MARKS}>` express the
  34×13 grid cleanly and keep rendering in lockstep with `data.ts`.
- **Maintainability:** small typed components (`Cell`, `HeaderRow`, `Toolbar`, `Legend`) with signals
  for UI state (view mode, filters) are far easier to extend than imperative DOM code. **TypeScript**
  types the data model (`CharId`, `MarkId`, `QualityKey`, `CellState`), catching a whole class of
  errors given the large `UNLOCKS` matrix.
- **Self-contained output:** Vite bundles Solid *into* the app — no CDN, no runtime external requests.
  This preserves the "app never contacts the network at runtime" guarantee (see §5).

Trade-off vs. the earlier vanilla idea: there is now a **build step** (Vite). That's an accepted cost
for maintainability. Dev = `npm run dev` (HMR); ship = `npm run build` → static `dist/`. Keep the
dependency set minimal: `solid-js`, `vite`, `vite-plugin-solid`, `typescript` — nothing else needed.

Proposed structure (standard Vite + Solid layout):

```
isaac-marks/
├── index.html                # Vite entry; mounts #root
├── package.json              # scripts: dev / build / preview / scrape
├── vite.config.ts            # solid plugin; base: './' so built dist/ can open from file:// (see §13)
├── tsconfig.json
├── src/
│   ├── main.tsx              # render(() => <App/>, #root)
│   ├── App.tsx               # layout: Toolbar + Legend + Grid
│   ├── data.ts               # CHARACTERS, MARKS, UNLOCKS, QUALITIES + types (see §6) — single source of truth
│   ├── store.ts              # Solid createStore for marks + UI signals; localStorage load/save (see §10)
│   ├── styles.css            # grid, sticky headers, cell states, theme (or CSS modules per component)
│   └── components/
│       ├── Grid.tsx          # builds the sticky grid via <For> over CHARACTERS × MARKS
│       ├── Cell.tsx          # one (char, mark) cell: unlock sprite OR mark icon + completion state
│       ├── HeaderRow.tsx     # sticky character-icon column headers
│       ├── BossHeader.tsx    # sticky boss-image row headers
│       ├── Toolbar.tsx       # mode toggle, progress, reset, export/import, filters
│       └── Legend.tsx        # the KEY (quality colors) + completion-state key
├── scripts/
│   └── scrape-assets.ts      # ONE-TIME scraper: pulls wiki images into public/assets/ (see §5). Build-time only.
├── public/                   # Vite serves/copies these verbatim to dist/ (referenced as /assets/...)
│   └── assets/               # committed, self-contained image bundle — app's single source of truth for imagery
│       ├── characters/       # 34 character icons — column headers (scraped once, see §5)
│       ├── bosses/           # 13 boss images — left-column row headers (scraped once, see §5)
│       ├── marks/            # 13 completion-mark icons — for Completion Mark Mode (scraped once, see §5)
│       └── items/            # unique unlock item sprites — cell contents in guide view (scraped once, see §5)
├── image.png                 # the original reference (kept for parity checking only)
└── PLAN.md
```

Scaffold with `npm create vite@latest . -- --template solid-ts`, then add the scraper and `scrape`
script. Put images under `public/assets/` so Vite copies them to `dist/assets/` untouched and they're
referenced by stable root-relative paths (`/assets/characters/isaac.png`) that need no bundler
imports.

---

## 5. Image assets — how to get them reliably

The wiki is MediaWiki-based. Raw files live under `/images/` but at **MD5‑hashed subpaths** (e.g.
`/images/a/ab/Character_Isaac_icon.png`) that you cannot guess. The reliable, hash‑free way to
resolve any file by name is the **`Special:FilePath` redirect**:

```
https://bindingofisaacrebirth.wiki.gg/wiki/Special:FilePath/<Exact_File_Name.png>
```

This 302‑redirects to the real `/images/...` URL and streams the PNG. **Confirmed working** during
planning: `Special:FilePath/Character_Isaac_icon.png` returned the actual icon. A **wrong filename
404s**, which gives you a cheap way to verify names (see gotchas in §12).

URL-encoding matters: the `???` character's file is `Character_???_icon.png` → encode the question
marks as `%3F%3F%3F`. Spaces become `_` in wiki filenames (already reflected below).

### Strategy: scrape all images ONCE at build time; the app is the single source of truth

**Requirement (not optional): the running app must never contact the wiki.** Scrape every needed
image one time as a **build/setup step**, commit them into `assets/`, and have the app reference
**only** those local files. At runtime there are **zero** network requests to
`bindingofisaacrebirth.wiki.gg` (or anywhere else) — the bundled `assets/` directory is the app's
single source of truth for imagery. This keeps the app fully self-contained: offline-capable, fast,
immune to the wiki changing hashes/renaming files or rate-limiting, and with no runtime dependency
on `Special:FilePath`.

Concretely:
- `Special:FilePath` and the wiki are used **only by the one-time scraper script**, never in any
  `src/` component.
- No `<img src="https://...wiki.gg...">` anywhere in the app. No `onerror` that re-fetches from the
  wiki. Every `<img>` points at a root-relative path under `/assets/` (served from `public/assets/`).
- Commit the scraped images to the repo so the app works on a fresh clone with no re-scrape.

### The scraper (write this as a committed, re-runnable script)

Create `scripts/scrape-assets.ts` that imports the `CHARACTERS`, `MARKS`, and `UNLOCKS` data from
`../src/data.ts` — the **same single source of truth** — so the download list can never drift from
what the app renders. Wire it as an npm script and run it with a TS-aware runner:

```jsonc
// package.json → "scripts"
"scrape": "tsx scripts/scrape-assets.ts"   // or: node --experimental-strip-types scripts/scrape-assets.ts (Node ≥ 22.6)
```

It scrapes **four** categories into `public/assets/` (Vite copies `public/` verbatim into `dist/`):

1. **Characters** → `public/assets/characters/<id>.png` (34 column-header icons).
2. **Bosses** → `public/assets/bosses/<markId>.png` (13 left-column row-header images).
3. **Marks** → `public/assets/marks/<markId>.png` (13 completion-mark icons, for Completion Mark Mode).
4. **Items** → `public/assets/items/<slug>.png` (the unique unlock sprites referenced by the
   `UNLOCKS` matrix — **dedupe by wiki filename**, since the same item can unlock in several cells).

For each entry it fetches `Special:FilePath/<wikiFile>` and writes to a **local, stable filename** so
`data.ts` references never depend on the wiki's naming quirks. The script should:

- Create the four `public/assets/*` subdirs if missing.
- URL-encode filenames (the `???` characters need `%3F%3F%3F`; item names have apostrophes/spaces).
- Follow redirects (`Special:FilePath` 302s to the hashed `/images/...` path).
- **Dedupe** item downloads by wiki filename (map filename → local slug once).
- **Fail loudly**: if any file 404s or is empty, print exactly which `id`/`wikiFile` failed and exit
  non-zero, so missing assets are fixed at scrape time — never papered over at runtime. (Expect to
  iterate here: item sprite filenames are the most error-prone — see §12.)
- Be idempotent / re-runnable, and **skip files already present** so re-runs only fetch the gaps
  (be gentle on the wiki — this is hundreds of item sprites).
- Optionally verify content-type is an image and size > 0 before writing.

Node/TS example (run once: `npm run scrape`):

```ts
import { CHARACTERS, MARKS, UNLOCKS } from "../src/data.ts";
import { mkdir, writeFile, access } from "node:fs/promises";

const BASE = "https://bindingofisaacrebirth.wiki.gg/wiki/Special:FilePath/";
const ROOT = "public/assets";
const slug = (f: string) => f.replace(/\.png$/i, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase();

// Unique unlock sprites across the whole matrix (skip cells with no unlock).
const itemFiles = new Map<string, string>(); // wikiFile -> local slug
for (const marks of Object.values(UNLOCKS))
  for (const cell of Object.values(marks))
    if (cell?.wikiFile) itemFiles.set(cell.wikiFile, slug(cell.wikiFile));

const jobs = [
  ...CHARACTERS.map(c => ({ dir: `${ROOT}/characters`, out: c.id,     file: c.wikiFile })),
  ...MARKS.map(m      => ({ dir: `${ROOT}/bosses`,     out: m.id,     file: m.bossFile })),
  ...MARKS.map(m      => ({ dir: `${ROOT}/marks`,      out: m.id,     file: m.markFile })),
  ...[...itemFiles].map(([file, s]) => ({ dir: `${ROOT}/items`, out: s, file })),
];
for (const d of ["characters", "bosses", "marks", "items"]) await mkdir(`${ROOT}/${d}`, { recursive: true });

let failed = 0;
for (const { dir, out, file } of jobs) {
  if (!file) continue; // NO UNLOCK cells / optional images
  const dest = `${dir}/${out}.png`;
  try { await access(dest); console.log(`skip ${dest}`); continue; } catch {} // already have it
  const url = BASE + encodeURIComponent(file);
  try {
    const res = await fetch(url, { redirect: "follow" });
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok || buf.length === 0) throw new Error(`HTTP ${res.status}, ${buf.length}B`);
    await writeFile(dest, buf);
    console.log(`ok   ${dest}  <- ${file}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${dest}  <- ${file}  (${url})  ${e.message}`);
  }
}
if (failed) { console.error(`\n${failed} asset(s) failed — fix names in data.ts and re-run.`); process.exit(1); }
```

PowerShell equivalent (user's primary shell) for a single file, if scripting by hand:

```powershell
$base = "https://bindingofisaacrebirth.wiki.gg/wiki/Special:FilePath/"
New-Item -ItemType Directory -Force public\assets\characters, public\assets\marks | Out-Null
Invoke-WebRequest "$base$([uri]::EscapeDataString($file))" -OutFile "public\assets\characters\$id.png"
```

**Runtime "fallback" is text only, never network.** Because assets are guaranteed present after a
successful scrape, a broken `<img>` at runtime is a bug — handle it with an `onerror` that swaps in
the character/mark **text label** (so the grid never visually breaks), but it must **not** reach out
to the wiki. If images are missing, the fix is to re-run the scraper, not to hotlink.

### Which images to use

Four asset categories:

Local files live in `public/assets/…` and are referenced by the app at root-relative `/assets/…`.

- **Column headers (characters):** the small mugshot icons — `Character_<Name>_icon.png` (the
  head-shots used in the reference image's top row). → `/assets/characters/<id>.png`.
- **Row headers (bosses):** the **boss portrait/mugshot** for each row, matching the reference's
  left column (Mom's Heart, Isaac, ???, Satan, The Lamb, Mega Satan, Boss Rush, Hush, Delirium,
  Mother, The Beast, Ultra Greed, Ultra Greedier). → `/assets/bosses/<markId>.png`. Boss image
  filenames vary on the wiki (e.g. a boss's page image or an `_icon`/portrait file) — **verify each
  via `Special:FilePath`** and record the confirmed name in `MARKS[].bossFile`.
- **Completion-mark icons (for Completion Mark Mode):** the authentic `Completion_*.png` marks, one
  per row → `/assets/marks/<markId>.png`, stored in `MARKS[].markFile`. State is expressed with CSS
  (dim = none, solid = Normal, red glow/outline = Hard); optionally swap to the real
  `Completion_*_Hard.png` art for Hard.
- **Unlock item sprites (guide view cell contents):** one sprite per non-empty cell, referenced by
  the `UNLOCKS` matrix → `/assets/items/<slug>.png`, deduped by filename. Item filename patterns on
  the wiki (verify via `Special:FilePath`):
  - Collectibles: `Collectible_<Name>_icon.png` (e.g. `Collectible_Sacrificial_Dagger_icon.png`)
  - Trinkets: `Trinket_<Name>_icon.png`
  - Cards/Runes: `Card_<Name>_icon.png` / `Rune_<Name>_icon.png`
  - Pills, consumables, co‑op babies, and "Character"/"Game Feature" unlocks have their own naming —
    confirm each. Apostrophes and spaces occur in names (URL-encode them).

Mark‑icon filenames gathered from the wiki (these populate `MARKS[].markFile`; verify each against
`Category:Completion mark icons` before downloading — the boss↔filename mapping in particular should
be confirmed):

| Row (boss/challenge) | Normal icon file          | Hard icon file (optional)      |
|----------------------|---------------------------|--------------------------------|
| Mom's Heart          | `Completion_Heart.png`    | `Completion_Heart_Hard.png`    |
| Isaac                | `Completion_Cathedral.png`| `Completion_Cathedral_Hard.png`|
| ??? (Blue Baby)      | `Completion_Chest.png`    | `Completion_Chest_Hard.png`    |
| Satan                | `Completion_Sheol.png`    | `Completion_Sheol_Hard.png`    |
| The Lamb             | `Completion_DarkRoom.png` | `Completion_DarkRoom_Hard.png` |
| Mega Satan           | `Completion_Brimstone.png`| `Completion_Brimstone_Hard.png`|
| Boss Rush            | `Completion_BossRush.png` | `Completion_BossRush_Hard.png` |
| Hush                 | `Completion_BlueWomb.png` | `Completion_BlueWomb_Hard.png` |
| Delirium             | `Completion_Void.png`     | `Completion_Void_Hard.png`     |
| Mother               | `Completion_Mother.png`   | `Completion_Mother_Hard.png`   |
| The Beast            | `Completion_Beast.png`    | `Completion_Beast_Hard.png`    |
| Ultra Greed          | `Completion_Greed.png`    | `Completion_Greed_Hard.png`    |
| Ultra Greedier       | `Completion_Greed.png`    | `Completion_Greed_Hard.png`    |

> Row headers already use boss portraits (`bossFile`), so mark icons are only needed for Completion
> Mark Mode. If a mark icon is too fiddly to pin down, render that mode's cell state with pure CSS
> shapes (empty box → black check → red check) instead. Correctness doesn't depend on pixel-authentic
> mark art — prioritize a complete, working grid over asset perfection.

---

## 6. Data model (single source of truth → `src/data.ts`)

Four structures drive the app: the ordered `CHARACTERS` (columns) and `MARKS` (rows) arrays define
the grid; `UNLOCKS` supplies the per-cell guide data; `QUALITIES` defines the KEY colors. **Order
matters** for the arrays — match the reference image left→right and top→bottom.

### Types

TypeScript types keep the large `UNLOCKS` matrix honest and give editor autocomplete for ids.

```ts
// src/data.ts
export type QualityKey =
  | "q4" | "q3" | "q2" | "q1" | "q0"
  | "trinket" | "coop" | "character" | "feature" | "consumable";

export interface Character { id: string; label: string; wikiFile: string; tainted: boolean; }
export interface Mark      { id: string; label: string; bossFile: string; markFile: string; }
export interface Unlock    { item: string; wikiFile: string; quality: QualityKey; }

// Derived id unions (optional but nice): typeof CHARACTERS[number]["id"], etc.
export type CharId = (typeof CHARACTERS)[number]["id"];
export type MarkId = (typeof MARKS)[number]["id"];

/** Sparse: UNLOCKS[charId]?.[markId] — missing entry = NO UNLOCK cell. */
export type UnlockMatrix = Partial<Record<string, Partial<Record<string, Unlock>>>>;

/** User completion state per cell. */
export type CellState = 0 | 1 | 2; // 0 none · 1 normal · 2 hard
```

### Characters (columns), in reference-image order

Untainted (17): `Isaac, Magdalene, Cain, Judas, ??? (Blue Baby), Eve, Samson, Azazel, Lazarus,
Eden, The Lost, Lilith, Keeper, Apollyon, The Forgotten, Bethany, Jacob & Esau`

Tainted (17): the same order, each prefixed "Tainted". Note filename quirks: Tainted Blue Baby is
`Character_Tainted_???_icon.png`; **Tainted Jacob is a solo character** (`Character_Tainted_Jacob_icon.png`),
not "Jacob and Esau". Verify `The Lost`/`The Forgotten` tainted filenames (may be `Tainted_The_Lost`
vs `Tainted_Lost`) via `Special:FilePath` before committing (§12).

```ts
export const CHARACTERS: Character[] = [
  // id            label              wikiFile (for downloading)             tainted
  { id: "isaac",        label: "Isaac",         wikiFile: "Character_Isaac_icon.png",         tainted: false },
  { id: "magdalene",    label: "Magdalene",     wikiFile: "Character_Magdalene_icon.png",     tainted: false },
  { id: "cain",         label: "Cain",          wikiFile: "Character_Cain_icon.png",          tainted: false },
  { id: "judas",        label: "Judas",         wikiFile: "Character_Judas_icon.png",         tainted: false },
  { id: "blue_baby",    label: "Blue Baby",     wikiFile: "Character_???_icon.png",           tainted: false },
  { id: "eve",          label: "Eve",           wikiFile: "Character_Eve_icon.png",           tainted: false },
  { id: "samson",       label: "Samson",        wikiFile: "Character_Samson_icon.png",        tainted: false },
  { id: "azazel",       label: "Azazel",        wikiFile: "Character_Azazel_icon.png",        tainted: false },
  { id: "lazarus",      label: "Lazarus",       wikiFile: "Character_Lazarus_icon.png",       tainted: false },
  { id: "eden",         label: "Eden",          wikiFile: "Character_Eden_icon.png",          tainted: false },
  { id: "the_lost",     label: "The Lost",      wikiFile: "Character_The_Lost_icon.png",      tainted: false },
  { id: "lilith",       label: "Lilith",        wikiFile: "Character_Lilith_icon.png",        tainted: false },
  { id: "keeper",       label: "Keeper",        wikiFile: "Character_Keeper_icon.png",        tainted: false },
  { id: "apollyon",     label: "Apollyon",      wikiFile: "Character_Apollyon_icon.png",      tainted: false },
  { id: "the_forgotten",label: "The Forgotten", wikiFile: "Character_The_Forgotten_icon.png", tainted: false },
  { id: "bethany",      label: "Bethany",       wikiFile: "Character_Bethany_icon.png",       tainted: false },
  { id: "jacob_esau",   label: "Jacob & Esau",  wikiFile: "Character_Jacob_and_Esau_icon.png",tainted: false },

  { id: "t_isaac",        label: "Tainted Isaac",        wikiFile: "Character_Tainted_Isaac_icon.png",        tainted: true },
  { id: "t_magdalene",    label: "Tainted Magdalene",    wikiFile: "Character_Tainted_Magdalene_icon.png",    tainted: true },
  { id: "t_cain",         label: "Tainted Cain",         wikiFile: "Character_Tainted_Cain_icon.png",         tainted: true },
  { id: "t_judas",        label: "Tainted Judas",        wikiFile: "Character_Tainted_Judas_icon.png",        tainted: true },
  { id: "t_blue_baby",    label: "Tainted Blue Baby",    wikiFile: "Character_Tainted_???_icon.png",          tainted: true },
  { id: "t_eve",          label: "Tainted Eve",          wikiFile: "Character_Tainted_Eve_icon.png",          tainted: true },
  { id: "t_samson",       label: "Tainted Samson",       wikiFile: "Character_Tainted_Samson_icon.png",       tainted: true },
  { id: "t_azazel",       label: "Tainted Azazel",       wikiFile: "Character_Tainted_Azazel_icon.png",       tainted: true },
  { id: "t_lazarus",      label: "Tainted Lazarus",      wikiFile: "Character_Tainted_Lazarus_icon.png",      tainted: true },
  { id: "t_eden",         label: "Tainted Eden",         wikiFile: "Character_Tainted_Eden_icon.png",         tainted: true },
  { id: "t_lost",         label: "Tainted Lost",         wikiFile: "Character_Tainted_The_Lost_icon.png",     tainted: true },
  { id: "t_lilith",       label: "Tainted Lilith",       wikiFile: "Character_Tainted_Lilith_icon.png",       tainted: true },
  { id: "t_keeper",       label: "Tainted Keeper",       wikiFile: "Character_Tainted_Keeper_icon.png",       tainted: true },
  { id: "t_apollyon",     label: "Tainted Apollyon",     wikiFile: "Character_Tainted_Apollyon_icon.png",     tainted: true },
  { id: "t_forgotten",    label: "Tainted Forgotten",    wikiFile: "Character_Tainted_The_Forgotten_icon.png",tainted: true },
  { id: "t_bethany",      label: "Tainted Bethany",      wikiFile: "Character_Tainted_Bethany_icon.png",      tainted: true },
  { id: "t_jacob",        label: "Tainted Jacob",        wikiFile: "Character_Tainted_Jacob_icon.png",        tainted: true },
];
```

### Marks (rows), in reference-image order

Each row carries **two** wiki files: `bossFile` (the row-header boss image) and `markFile` (the
completion-mark icon shown in Completion Mark Mode). `bossFile` names must be **verified via
`Special:FilePath`** — boss image naming is inconsistent on the wiki — so the values below are
placeholders to confirm, not gospel.

```ts
export const MARKS: Mark[] = [
  // id                label            bossFile (row-header image — VERIFY)   markFile (mark icon)
  { id: "moms_heart",     label: "Mom's Heart",    bossFile: "Mom's_Heart_icon.png",   markFile: "Completion_Heart.png" },
  { id: "isaac",          label: "Isaac",          bossFile: "Isaac_icon.png",         markFile: "Completion_Cathedral.png" },
  { id: "blue_baby",      label: "??? (Blue Baby)",bossFile: "Blue_Baby_icon.png",     markFile: "Completion_Chest.png" },
  { id: "satan",          label: "Satan",          bossFile: "Satan_icon.png",         markFile: "Completion_Sheol.png" },
  { id: "lamb",           label: "The Lamb",       bossFile: "The_Lamb_icon.png",      markFile: "Completion_DarkRoom.png" },
  { id: "mega_satan",     label: "Mega Satan",     bossFile: "Mega_Satan_icon.png",    markFile: "Completion_Brimstone.png" },
  { id: "boss_rush",      label: "Boss Rush",      bossFile: "Boss_Rush_icon.png",     markFile: "Completion_BossRush.png" },
  { id: "hush",           label: "Hush",           bossFile: "Hush_icon.png",          markFile: "Completion_BlueWomb.png" },
  { id: "delirium",       label: "Delirium",       bossFile: "Delirium_icon.png",      markFile: "Completion_Void.png" },
  { id: "mother",         label: "Mother",         bossFile: "Mother_icon.png",        markFile: "Completion_Mother.png" },
  { id: "beast",          label: "The Beast",      bossFile: "The_Beast_icon.png",     markFile: "Completion_Beast.png" },
  { id: "ultra_greed",    label: "Ultra Greed",    bossFile: "Ultra_Greed_icon.png",   markFile: "Completion_Greed.png" },
  { id: "ultra_greedier", label: "Ultra Greedier", bossFile: "Ultra_Greedier_icon.png",markFile: "Completion_Greed.png" },
];
```

### Unlock matrix (`UNLOCKS`) — the guide data

This is the largest dataset and the **main data-entry task**. It maps each `(characterId, markId)`
to the item that cell unlocks, its sprite file, and its quality/type (for the background color). A
missing entry means **"NO UNLOCK"** — the cell shows a neutral background and no sprite but is still
a valid completion toggle.

```ts
export const UNLOCKS: UnlockMatrix = {
  // charId: { markId: { item, wikiFile, quality } }   // omit a markId = NO UNLOCK for that cell
  isaac: {
    moms_heart: { item: "Lost Baby",      wikiFile: "<verify co-op baby file>.png",         quality: "coop" },
    isaac:      { item: "Isaac's Tears",  wikiFile: "Collectible_Isaac's_Tears_icon.png",   quality: "q2" },
    // ...one entry per non-empty cell in Isaac's column...
  },
  // ...all 34 characters...
};
```

**Source of truth for this matrix:** transcribe it from `image.png` (the reference chart the user
provided — it is legible and is exactly the layout they want), cross-checking each item name against
the wiki to capture the correct sprite `wikiFile` and quality color. This is tedious (~442 cells,
minus NO UNLOCK regions); see §11 for a phased approach that ships a working app *before* the matrix
is fully populated. Missing/unknown entries degrade gracefully to NO UNLOCK cells.

### Quality/type colors (`QUALITIES`) — the KEY

Reproduce the reference's KEY as the cell-background palette. Sample the **exact** hex values from
`image.png`; the values below are close starting points.

```ts
export const QUALITIES: Record<QualityKey, { label: string; color: string }> = {
  q4:         { label: "Quality 4",    color: "#f1c40f" }, // yellow
  q3:         { label: "Quality 3",    color: "#d9539b" }, // magenta/pink
  q2:         { label: "Quality 2",    color: "#7fc7e8" }, // light blue
  q1:         { label: "Quality 1",    color: "#7fbf4d" }, // green
  q0:         { label: "Quality 0",    color: "#9e9e9e" }, // gray
  trinket:    { label: "Trinket",      color: "#e06666" }, // red/salmon
  coop:       { label: "Co-op Baby",   color: "#2b2f4a" }, // dark navy
  character:  { label: "Character",    color: "#111111" }, // black
  feature:    { label: "Game Feature", color: "#6d8c3a" }, // olive green
  consumable: { label: "Consumables",  color: "#c69a63" }, // tan/brown
};
```

### Cell state

Completion tracking is separate from the unlock data above. Each `(character, mark)` cell holds one
integer of **user** state:

```
0 = none    (not earned)
1 = normal  (Normal mode — solid black mark)
2 = hard    (Hard mode — red-outlined mark)
```

So a cell combines **static** data (`UNLOCKS[char][mark]` → sprite + quality color) with **dynamic**
data (the user's 0/1/2 completion state). The display mode (§7) decides whether the cell foreground
is the unlock sprite or the completion-mark icon; the completion state is always reflected.

---

## 7. UI / layout spec

- **Grid** with characters as columns and marks as rows, matching `image.png` orientation.
- **Sticky top header row** = character icons (with `title`/tooltip and visually‑hidden text label).
- **Sticky left header column** = **boss image** (`/assets/bosses/<markId>.png`) + short boss name,
  like the reference chart.
- **Top-left corner cell** stays fixed (both sticky), like a spreadsheet freeze‑panes.
- The grid is wide (34 columns). Wrap it in a horizontally scrollable container
  (`overflow-x: auto`) so the page body never scrolls sideways. Keep cells reasonably small
  (e.g. 40–52px — a touch larger than the base tracker so item sprites read clearly).
- Optional visual separator between the untainted (first 17) and tainted (last 17) column blocks.
- **Theme:** dark background to match the game's aesthetic; states must be clearly distinguishable.
- **Toolbar** (above the grid): the **Completion Mark Mode** toggle, progress summary, filter
  toggles, and data actions (§9, §10).
- **Legend:** the reference **KEY** (quality/type colors from `QUALITIES`) *and* the three
  completion states.

### Two display modes (toggle in the toolbar)

**A. Unlock / Guide mode (default)** — reproduces the reference chart plus your progress:
- Cell **background** = the unlock's quality/type color from `QUALITIES` (NO-UNLOCK cells get a
  neutral background).
- Cell **foreground** = the unlock **item sprite** (`/assets/items/<slug>.png`); item name on hover
  (`title`) / tooltip.
- **Completion state treatment** layered on top:
  - `none` — sprite desaturated/dimmed (~40%), cell reads as "not done yet".
  - `normal` — full-color sprite, subtle check/indicator badge in a corner.
  - `hard` — full-color sprite with a **red outline/glow** + red check badge.

**B. Completion Mark mode** — a clean marks view mirroring the in-game completion-marks page:
- Cell **foreground** = the row's **completion-mark icon** (`/assets/marks/<markId>.png`), same icon
  down the whole row.
- Rendered by state: `none` = empty/faint (~15%), `normal` = solid, `hard` = red-outlined/glow.
- Background neutral (quality colors hidden), so the eye reads marks, not item rarities.

The toggle is a global view switch; it does **not** change any stored data — both modes render the
same underlying completion state. Persist the last-used mode in `localStorage` too (see §10).

---

## 8. Interaction spec

- **Left‑click a cell** cycles its **completion** state forward: `none → normal → hard → none` by
  calling `setMarks(charId, markId, next)` on the store; Solid's fine-grained reactivity updates only
  that cell's DOM. Clicking behaves identically in both display modes (§7) — the mode only changes
  what the cell *shows*, never what a click does.
- **Hover a cell** shows the unlock's item name (and optionally its quality) via `title`/tooltip,
  so the guide info is available even in Completion Mark mode.
- **Right‑click a cell** cycles backward: `none → hard → normal → none` (call `preventDefault` on
  `contextmenu`). Nice-to-have.
- **Keyboard:** cells are focusable (`tabindex`, arrow-key navigation optional); Enter/Space cycles
  forward. Provide `role="gridcell"` semantics if practical.
- Header **row/column click** (optional power feature): cycle or clear an entire character column or
  an entire boss row at once. Guard destructive bulk clears behind a confirm.
- Persistence is automatic: a single `createEffect` serializes the store to `localStorage` on any
  change (§10) — no manual save call per interaction.

---

## 9. Toolbar / extra features

Baseline (implement these):
- **Completion Mark Mode toggle:** switches all cells between Unlock/Guide view and Completion Mark
  view (§7). Persist the choice.
- **Progress counters:** e.g. "Marks: 142/442" (442 = 34 chars × 13 marks) and a separate
  "Hard: N" count. Optionally per-character completion in the column header tooltip.
- **Reset button:** clears all state (with a confirm dialog).
- **Export / Import JSON:** export current state to a downloadable `.json`; import restores it. This
  gives the user a backup path independent of the browser's `localStorage`.

Nice-to-have:
- **Filter:** show only untainted / only tainted / all characters.
- **"Hide completed rows/columns"** toggle to focus on what's left.
- **Hard-mode-only view** highlighting cells not yet at Hard.

---

## 10. State & persistence (`src/store.ts`)

Model the app state with a Solid **`createStore`** and mirror it to `localStorage` via a single
effect. Fine-grained updates mean a cell only re-renders when *its* value changes.

```ts
import { createStore } from "solid-js/store";
import { createEffect } from "solid-js";

const STORAGE_KEY = "isaac-completion-marks";

// Persisted JSON shape:
// {
//   "version": 1,
//   "updatedAt": "2026-08-18T00:00:00.000Z",
//   "ui": { "markMode": false },   // false = Unlock/Guide view, true = Completion Mark view
//   "marks": {
//     "isaac":       { "moms_heart": 2, "isaac": 1, "satan": 1 },  // omit or 0 = none
//     "t_forgotten": { "hush": 2 }                                 // sparse: only non-zero cells
//   }
// }

const [state, setState] = createStore(loadState()); // loadState() validates/migrates or returns empty

// Autosave: re-runs whenever any tracked field changes.
createEffect(() => {
  const snapshot = { ...state, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch {}
});

export function cell(charId: string, markId: string): CellState {
  return (state.marks[charId]?.[markId] ?? 0) as CellState;
}
export function cycle(charId: string, markId: string) {
  const next = ((cell(charId, markId) + 1) % 3) as CellState;
  setState("marks", charId, (m) => ({ ...(m ?? {}), [markId]: next }));
}
```

Rules:
- **`loadState()`** — parse the key; on missing/corrupt JSON return a fresh empty state (never throw
  into the UI). Validate character/mark ids against `data.ts`; drop unknown ids. Handle `version`
  migrations here.
- **Sparse writes** — keep only non-zero cells so storage and export files stay small (optionally
  prune `0`s before serializing).
- **`ui.markMode`** and any filters live in the same store, so they persist and drive rendering
  reactively.
- **`reset()`** — `setState({ ...empty })` and `localStorage.removeItem(STORAGE_KEY)` (behind a
  confirm).
- **Export / Import** — export the serialized snapshot to a downloadable `.json`; import validates
  the shape, then `setState(reconcile(imported))` so the grid updates in place.

---

## 11. Ordered implementation plan (milestones)

The unlock matrix is large, so ship a **fully working tracker first**, then layer the guide data on
top — the app must be usable at every step, and missing unlock data always degrades to NO-UNLOCK
cells rather than breaking anything.

**Phase 1 — working tracker (no unlock data yet)**
1. **Scaffold:** `npm create vite@latest . -- --template solid-ts`, install deps, confirm
   `npm run dev` serves a starter page. Add the `scripts/` dir and `public/assets/*` subdirs, and the
   `scrape` npm script.
2. **Grid data:** author `src/data.ts` with the types, the full `CHARACTERS` (34) and `MARKS` (13)
   arrays, and the `QUALITIES` map. Leave `UNLOCKS` empty/partial for now.
3. **Scrape headers (one-time build step):** write `scripts/scrape-assets.ts` (§5); verify uncertain
   filenames via `Special:FilePath` (§12); `npm run scrape` to pull the 34 character icons, 13 boss
   images, and 13 mark icons into `public/assets/` and **commit them**. After this the app references
   only local files and never touches the wiki. Add `onerror` **text** fallbacks (no network).
4. **Render grid:** build `Grid`/`HeaderRow`/`BossHeader`/`Cell` components with `<For>` — character
   icons across the top, boss images down the left. Confirm orientation matches `image.png` and
   sticky headers stick on scroll.
5. **State + persistence:** wire `src/store.ts` (`createStore` + autosave effect); cells read their
   value via `cell(charId, markId)`.
6. **Interaction:** click cycling via `cycle()` (§8); right-click reverse. Verify fine-grained
   updates (only the clicked cell re-renders).
7. **Completion Mark Mode + toolbar:** `Toolbar` with the mode toggle (§7), progress counters, reset
   (confirm), export/import. In this phase both modes render the mark/state (unlock sprites come next).

**Phase 2 — layer in the unlock guide**
8. **Unlock matrix:** populate `UNLOCKS` in `data.ts` by transcribing `image.png` and confirming each
   item's sprite `wikiFile` + `quality` against the wiki (§6). Do it in chunks (e.g. column-by-column
   or row-by-row); the app keeps working as entries fill in.
9. **Scrape items:** re-run `npm run scrape` to fetch the deduped item sprites into `public/assets/items/` and
   **commit them**. Expect to fix filename misses (§12) and re-run.
10. **Guide rendering:** in Unlock/Guide mode, render each cell's quality-colored background + item
    sprite + hover name, with the completion-state treatment on top (§7). NO-UNLOCK cells stay
    neutral but clickable.

**Phase 3 — polish & verify**
11. **Polish:** dark theme, KEY legend, untainted/tainted separator, keyboard focus, responsive
    scroll, optional filters.
12. **Verify:** run the checklist in §13.

---

## 12. Gotchas & considerations for the implementing agent

- **`Special:FilePath` is your friend.** It resolves any wiki file by name without MD5 hashes and
  **404s on a wrong name** — use that to verify uncertain filenames cheaply before bulk-downloading.
  Confirmed working: `.../Special:FilePath/Character_Isaac_icon.png`.
- **URL-encode `???`** as `%3F%3F%3F` (affects Blue Baby and Tainted Blue Baby).
- **Verify these specific uncertain filenames** before relying on them (they follow patterns that
  vary on the wiki): `Character_Tainted_The_Lost_icon.png` vs `..._Tainted_Lost_...`;
  `Character_Tainted_The_Forgotten_icon.png` vs `..._Tainted_Forgotten_...`;
  `Character_Tainted_Jacob_icon.png` (Tainted Jacob is solo). If a name 404s, open the character's
  wiki page or `Special:WhatLinksHere` to find the real file.
- **Confirm the boss↔mark-icon mapping** in §5 against `Category:Completion_mark_icons`. The mapping
  was compiled from a summarizer and should be spot-checked. If any mark art is hard to pin down,
  fall back to pure-CSS state markers — do not let asset uncertainty block a complete, working grid.
- **Boss row-header images (`bossFile`) are unverified placeholders.** Wiki boss image naming is
  inconsistent — confirm each via `Special:FilePath` and fix `MARKS[].bossFile` before scraping. If a
  boss image is elusive, reuse that row's mark icon as the header rather than blocking.
- **Item sprites are the most error-prone assets.** Names carry apostrophes/spaces and vary by type
  (`Collectible_*_icon.png`, `Trinket_*_icon.png`, cards, pills, co-op babies, "Character"/"Game
  Feature" unlocks). Verify each via `Special:FilePath`; the scraper's fail-loud output tells you
  exactly which to fix. Populate `UNLOCKS` in chunks — the app works with it partially filled.
- **NO-UNLOCK cells still track completion.** A missing `UNLOCKS[char][mark]` entry renders a neutral
  cell with no sprite but must remain a clickable tri-state toggle (every character has all 13 marks).
- **Sample the KEY colors from `image.png`.** The `QUALITIES` hex values in §6 are approximations;
  eyedrop the real colors from the reference for an authentic match.
- **Scrape once, bundle, never hotlink.** All imagery is scraped at build time into `public/assets/`
  and committed; the running app makes **no** requests to the wiki. The wiki/`Special:FilePath`
  appear only in `scripts/scrape-assets.ts`. A missing image at runtime is fixed by re-running the
  scraper, not by fetching from the wiki — the only runtime fallback for a broken `<img>` is a text
  label.
- **Don't hardcode 34×13 cells.** Render everything with `<For>` over the data arrays; adding a
  character or mark later should require only a `data.ts` edit.
- **Keep state sparse** (store only non-zero cells) so `localStorage` stays small and export files
  stay readable.
- **Build-step specifics (SolidJS + Vite):**
  - Put images in `public/assets/` (not imported through the bundler) so they're referenced by
    stable root-relative `/assets/...` URLs and copied verbatim to `dist/`.
  - The scraper is Node/TS run via `tsx` (or `node --experimental-strip-types`), **not** through
    Vite — it imports `src/data.ts` at build time only.
  - Set `base: './'` in `vite.config.ts` so the built `dist/` also works when opened from `file://`
    (see §13).
  - Solid gotcha: never destructure store props (`const { id } = props`) — it breaks reactivity;
    read `props.id` / call accessors in JSX. Use `<For>` for lists and `<Show>` for conditionals.
- **This is a personal, single-user, offline app.** No backend, no accounts, no external calls at
  runtime once built. No security-sensitive surface.

---

## 13. Verification checklist (do this before declaring done)

- [ ] Grid shows **34 character columns** (17 untainted + 17 tainted) and **13 mark rows**, in the
      same orientation as `image.png`.
- [ ] Character icons, boss row-header images, mark icons, and unlock item sprites all load from
      `/assets/…` (or show a clean text fallback — none broken).
- [ ] **No runtime wiki access:** in both `npm run dev` and the built `dist/`, the DevTools Network
      tab shows **zero** requests to `bindingofisaacrebirth.wiki.gg` (or any external host, including
      CDNs — Solid is bundled). A grep of `src/**` for `wiki.gg` / `http` returns nothing (only
      `scripts/` may match).
- [ ] `public/assets/characters/` has 34 files, `public/assets/bosses/` 13, `public/assets/marks/`
      13, and `public/assets/items/` holds the deduped unlock sprites — all committed.
- [ ] **Unlock/Guide mode:** cells show the unlock sprite on the correct quality-color background
      (matches `image.png`); hovering shows the item name; NO-UNLOCK cells are neutral but clickable.
- [ ] **Completion Mark Mode toggle:** flips all cells to mark icons and back; the choice persists
      across reload; toggling never alters stored completion data.
- [ ] Clicking a cell cycles `none → normal → hard → none` with visually distinct states in **both**
      modes; Hard is clearly red-tinted.
- [ ] Reload the page → selections persist. Restart the browser → still persist.
- [ ] Progress counter updates live and matches the number of set cells.
- [ ] Reset clears everything (after confirm) and empties `localStorage`.
- [ ] Export produces a JSON file; Import restores an exported file exactly.
- [ ] Sticky top row and left column stay fixed while scrolling the wide grid; the page body does
      **not** scroll horizontally (only the grid container does).
- [ ] `npm run build` succeeds with no TypeScript errors; `npm run preview` serves the built app and
      it behaves identically to dev. No console errors in either.

> **Running it (document in a short README):** `npm install` once, then `npm run dev` for development.
> For everyday use, `npm run build` produces a self-contained `dist/`; serve it with `npm run preview`
> (or any static server). With `base: './'` in `vite.config.ts`, opening `dist/index.html` directly
> from `file://` also works in most browsers — verify this and note it, since it's the closest thing
> to the user's original "just open it" wish.

---

## 14. Out of scope (unless the user asks)

- **Tracking** unlock progress per item beyond the completion state — the unlock sprites are a
  read-only *reference/guide* layer; the thing the user tracks is the 13 completion marks per
  character (none/normal/hard).
- The extra reference rows from the chart that aren't completion marks (e.g. "All Marks" reward row);
  optional to show as a derived summary, not a tracked toggle.
- Enforcing mutual-exclusivity rules between marks (surface as a note at most).
- Cloud sync, accounts, multi-device sharing, achievements beyond the 13 tracked marks.

---

## 15. Skills/tools the agent should lean on

- **`WebFetch` / `Special:FilePath`** to verify filenames and to power the **one-time** scraper that
  downloads assets from the wiki. This is a build step only — the shipped app never uses them.
- **`run` skill** (or `npm run dev`) to launch and manually exercise the app.
- **`verify` skill** to drive the click→persist→reload flow end-to-end before finishing.
- **SolidJS docs** if unsure on reactivity idioms (`createStore`, `<For>`, `<Show>`, `createEffect`);
  keep the dep set to `solid-js`, `vite`, `vite-plugin-solid`, `typescript`.
- No `artifact-design` needed — this is a local site, not a published Artifact.
```
