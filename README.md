# Binding of Isaac — Completion Marks Tracker

A single-page tracker that reproduces the *Repentance* completion-marks chart (`image.png`) as a
real, interactive grid: **34 characters (columns) × 13 marks (rows)**. Every cell shows the item
that character unlocks for that boss *and* records whether **you** have that mark, on Normal or
Hard. Everything is saved to `localStorage`.

## Running it

```bash
npm install        # once
npm run dev        # development server with HMR  → http://localhost:5173
npm run build      # type-check + bundle into a self-contained dist/
npm run preview    # serve the built dist/
```

`vite.config.ts` sets `base: "./"`, so the built app also works when you just open
`dist/index.html` from `file://` — verified in Chromium, images and all.

**The app never touches the network.** All imagery lives in `public/assets/` (committed), and the
built bundle contains no external URLs — no wiki, no CDN, no fonts.

## Using it

| Action | Result |
| --- | --- |
| Left-click a cell | cycles `none → Normal → Hard → none` |
| Right-click a cell | cycles backwards |
| `Enter` / `Space` on a focused cell | cycles forwards |
| Click a character column header | fills the column with Normal, then Hard, then clears it (with a confirm) |
| Click a boss row header | same, across every character |
| Hover a cell | shows the character, the mark, the unlock and its quality, and your state |

**Completion Mark Mode** (toolbar) swaps every cell from the unlock sprite to that row's in-game
completion-mark icon, drawn on the game's post-it note: faint when not earned, solid black on
Normal, red on Hard — the same thing you see on the character-select screen. It is purely a view
switch; your data is untouched either way.

The toolbar also has live progress counters, character filters (all / untainted / tainted), a
"hide fully-Hard characters" toggle, **Export JSON** / **Import JSON** for backups, and **Reset**.

## Layout

```
src/
├── main.tsx              # mounts <App/>
├── App.tsx               # Toolbar + Grid + Legend
├── data.ts               # CHARACTERS, MARKS, QUALITIES, UNLOCKS — the single source of truth
├── store.ts              # Solid store + localStorage autosave, import/export, bulk edits
├── assets.ts             # the only place asset URLs are built
├── styles.css
└── components/           # Grid, Cell, HeaderRow, BossHeader, Toolbar, Legend, Sprite
scripts/scrape-assets.ts  # ONE-TIME wiki scraper — build step only, never used at runtime
public/assets/            # committed image bundle: 34 characters, 13 bosses, 13 marks, 340 items
```

## Where the data came from

`src/data.ts` was transcribed from `image.png`, the reference chart:

* Every cell's **item name** was read off the chart.
* Every cell's **quality colour** was sampled from the chart's own pixels and matched against the
  swatches in its KEY, so the palette in `QUALITIES` is exact rather than eyeballed.
* Every **wiki filename** was verified against the wiki before scraping, and each downloaded
  sprite was diffed against the corresponding cell of `image.png` to catch mis-mappings.

Two details worth knowing:

* **Merged blocks.** The chart merges some rows into one cell on the tainted side. Each row in a
  merged block carries the same unlock here, which matches the game: a Tainted character gets its
  trinket for beating *any* of Isaac / ??? / Satan / The Lamb, and its Soul stone for Boss Rush
  and Hush.
* **Chart labels are achievement names**, which occasionally differ from the item's own name
  (the chart's "Blood Penny" is the trinket *Bloody Penny*, "Fart Baby" is *Farting Baby*). Labels
  follow the chart; sprites are the real item art.

`UNLOCKS` covers 408 of the 442 cells. The other 34 — every tainted character on Mom's Heart and on
Ultra Greed — are the chart's "NO UNLOCK" regions: they render as neutral cells but are still fully
clickable, because in game those characters do have those marks.

Six unlocks are game features with no standalone sprite on the wiki (Sticky Nickels, Corrupted
Data, Fool's Gold, Golden Trinkets, Gold Pills, Horse Pills); those use the wiki's achievement
icon, which is framed rather than a bare sprite. Delirium has no small mark glyph in game — beating
it changes the whole post-it note — so Completion Mark Mode shows the note itself for that row.

## Re-scraping assets

`public/assets/` is committed, so a fresh clone needs no scrape. If you add a character, mark, or
unlock to `src/data.ts`:

```bash
npm run scrape     # downloads only what's missing, backs off when the wiki rate-limits,
                   # and exits non-zero naming any file it could not fetch
```

The scraper imports `src/data.ts` directly, so the download list can never drift from what the app
renders. It is the only file in the project that knows the wiki exists.
