/**
 * ONE-TIME asset scraper — BUILD STEP ONLY.
 *
 * Downloads every image the app needs from the Binding of Isaac wiki into public/assets/,
 * which is committed to the repo. The running app never touches the network: it references
 * only ./assets/... paths. If an image is missing at runtime the fix is to re-run this
 * script, never to hotlink the wiki.
 *
 *   npm run scrape
 *
 * The download list is derived from src/data.ts — the same single source of truth the app
 * renders from — so the two can never drift. The script is idempotent: files already on
 * disk are skipped, so re-runs only fetch the gaps.
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import { CHARACTERS, MARKS, UNLOCKS, itemSlug } from "../src/data.ts";

const BASE = "https://bindingofisaacrebirth.wiki.gg/wiki/Special:FilePath/";
const ROOT = "public/assets";
const UA = "isaac-marks-tracker/1.0 (offline completion-marks tracker; one-time asset scrape)";
const DELAY_MS = 400;
const MAX_TRIES = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Job {
  dir: string;
  out: string;
  file: string;
}

/** Unique unlock sprites across the whole matrix (deduped by wiki filename). */
const itemFiles = new Map<string, string>(); // wikiFile -> local slug
for (const marks of Object.values(UNLOCKS)) {
  for (const cell of Object.values(marks ?? {})) {
    if (cell?.wikiFile) itemFiles.set(cell.wikiFile, itemSlug(cell.wikiFile));
  }
}

const jobs: Job[] = [
  ...CHARACTERS.map((c) => ({ dir: `${ROOT}/characters`, out: c.id, file: c.wikiFile })),
  ...MARKS.map((m) => ({ dir: `${ROOT}/bosses`, out: m.id, file: m.bossFile })),
  ...MARKS.map((m) => ({ dir: `${ROOT}/marks`, out: m.id, file: m.markFile })),
  ...[...itemFiles].map(([file, slug]) => ({ dir: `${ROOT}/items`, out: slug, file })),
];

for (const d of ["characters", "bosses", "marks", "items"]) {
  await mkdir(`${ROOT}/${d}`, { recursive: true });
}

let ok = 0;
let skipped = 0;
const failures: string[] = [];

for (const { dir, out, file } of jobs) {
  if (!file) continue;
  const dest = `${dir}/${out}.png`;
  try {
    await access(dest);
    skipped++;
    continue; // already have it — be gentle on the wiki
  } catch {
    /* not downloaded yet */
  }

  const url = BASE + encodeURIComponent(file);
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) {
        // Wiki is throttling us — back off and try this file again.
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt;
        lastError = `HTTP ${res.status}`;
        console.warn(`wait ${wait}ms  (HTTP ${res.status}, attempt ${attempt}/${MAX_TRIES})  ${file}`);
        await sleep(wait);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (buf.length === 0) throw new Error("empty response");
      if (!type.startsWith("image/")) throw new Error(`content-type ${type}`);
      await writeFile(dest, buf);
      ok++;
      lastError = "";
      console.log(`ok   ${dest}  <- ${file}`);
      break;
    } catch (e) {
      lastError = (e as Error).message;
      break; // a genuine 404 / bad name — no point retrying
    }
  }
  if (lastError) {
    failures.push(`FAIL ${dest}  <- ${file}  (${url})  ${lastError}`);
    console.error(failures.at(-1));
  }
  await sleep(DELAY_MS);
}

console.log(`\ndownloaded ${ok}, already present ${skipped}, failed ${failures.length}`);
if (failures.length) {
  console.error(`\n${failures.length} asset(s) failed — fix the names in src/data.ts and re-run:`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
