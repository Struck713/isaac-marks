import { CHARACTERS, type CellState } from "./data.ts";

/**
 * Reads the completion marks out of a *Binding of Isaac: Repentance* save file
 * (`rep+persistentgamedata1.dat` and friends), so the grid can be filled in from the game
 * instead of by hand.
 *
 * The format was reverse-engineered from a real save; `rev/FORMAT.md` documents it in full and
 * `rev/decode_save.py` is the reference implementation this module mirrors. The short version:
 *
 * - 16-byte magic, a constant word, then chunks of `id / declared_len / count / elements`.
 * - Marks are *not* their own chunk — they are `u32`s inside the counters chunk (2), one per
 *   (character, mark), as a bitmask: bit 0 = cleared on Normal, bit 1 = cleared on Hard.
 * - Rows were appended as the game grew, so each mark row is split into up to three runs of
 *   indices: the original 14 characters, The Forgotten alone, and Repentance's 19.
 *
 * Everything here is read-only: the file is never written back.
 */

const MAGIC = "ISAACNGSAVE09R";
const RUN_FILE_MAGIC = "ISAACNG_GSR";
const CHECKSUM_START = 0x10;
/** Afterbirth+ shares the `09R` magic with Repentance; its achievement array is much shorter. */
const MIN_REPENTANCE_ACHIEVEMENTS = 600;

/** Chunk id → element width in bytes. Chunk 11 (bestiary) is nested and not read here. */
const CHUNK_ELEMENT_BYTES: Record<number, number> = {
  1: 1, 2: 4, 3: 4, 4: 1, 5: 1, 6: 1, 7: 1, 8: 4, 9: 4, 10: 1,
};
const ACHIEVEMENTS_CHUNK = 1;
const COUNTERS_CHUNK = 2;

/**
 * Where each mark row lives in the counters chunk, as element indices:
 * `[characters 0–13, The Forgotten, characters 15–33]`. Index order is the game's, which is
 * chronological by when each mark was added — not the order the post-it draws them, and not
 * the order of `MARKS` in data.ts.
 */
const MARK_ROWS: ReadonlyArray<readonly [number, number, number]> = [
  [27, 203, 214], // Mom's Heart
  [41, 204, 233], // Isaac
  [55, 205, 252], // Satan
  [69, 206, 271], // Boss Rush
  [83, 207, 290], // ??? (Chest)
  [97, 208, 309], // The Lamb (Dark Room)
  [116, 209, 328], // Mega Satan
  [130, 210, 347], // Hush
  [144, 211, 366], // Ultra Greed *and* Ultra Greedier — one shared slot
  [173, 213, 404], // Delirium
  [423, 437, 438], // Mother
  [457, 471, 472], // The Beast
];

/**
 * Our mark id for each row above. `null` is the shared Greed slot, which the game stores as one
 * value (bit 0 = Ultra Greed, bit 1 = Ultra Greedier) but our chart splits into two rows.
 */
const ROW_MARK_IDS: ReadonlyArray<string | null> = [
  "moms_heart", "isaac", "satan", "boss_rush", "blue_baby", "lamb",
  "mega_satan", "hush", null, "delirium", "mother", "beast",
];

/** The save's character slots, in order — the same order as CHARACTERS in data.ts. */
const CHAR_IDS = CHARACTERS.map((c) => c.id);

const FORGOTTEN_SLOT = 14;
const FIRST_LATE_SLOT = 15;

export interface SaveFileMarks {
  /** Sparse, in the same shape as the store: only earned cells are present. */
  marks: Record<string, Record<string, CellState>>;
  earned: number;
  hard: number;
  /** False if the file's own checksum does not match its contents (edited or corrupt). */
  checksumValid: boolean;
}

/** Thrown with a message meant to be shown to the user as-is. */
export class SaveFileError extends Error {}

export function readSaveFile(buffer: ArrayBuffer): SaveFileMarks {
  const view = new DataView(buffer);
  const header = asciiAt(buffer, 0, 16);

  if (header.startsWith(RUN_FILE_MAGIC)) {
    throw new SaveFileError(
      "That file holds a single run's state. Pick a persistentgamedata file instead.",
    );
  }
  if (!header.startsWith(MAGIC)) {
    throw new SaveFileError("That is not a Repentance save file.");
  }

  const chunks = readChunks(view);

  const achievements = chunks.get(ACHIEVEMENTS_CHUNK);
  if (achievements !== undefined && achievements.count < MIN_REPENTANCE_ACHIEVEMENTS) {
    throw new SaveFileError("That is an Afterbirth+ save file, not a Repentance one.");
  }

  const counters = chunks.get(COUNTERS_CHUNK);
  if (counters === undefined) throw new SaveFileError("That save file has no counters section.");

  return { ...readMarks(view, counters), checksumValid: checksumMatches(view) };
}

interface ChunkRange {
  /** Byte offset of the first element. */
  offset: number;
  count: number;
}

/** Walks the chunk list up to and including the counters chunk, which is all we need. */
function readChunks(view: DataView): Map<number, ChunkRange> {
  const chunks = new Map<number, ChunkRange>();
  let offset = 20; // 16-byte magic + one constant word

  while (offset + 12 <= view.byteLength - 4) {
    const id = view.getUint32(offset, true);
    const count = view.getUint32(offset + 8, true);
    const elementBytes = CHUNK_ELEMENT_BYTES[id];
    if (elementBytes === undefined) break; // the bestiary, or something we do not know

    offset += 12;
    chunks.set(id, { offset, count });
    offset += count * elementBytes;
    if (offset > view.byteLength) throw new SaveFileError("That save file is truncated.");
    if (id === COUNTERS_CHUNK) break;
  }
  return chunks;
}

function readMarks(view: DataView, counters: ChunkRange) {
  const counter = (index: number) =>
    index < counters.count ? view.getUint32(counters.offset + index * 4, true) : 0;

  const marks: Record<string, Record<string, CellState>> = {};
  let earned = 0;
  let hard = 0;

  CHAR_IDS.forEach((charId, slot) => {
    const row: Record<string, CellState> = {};

    MARK_ROWS.forEach(([base, forgotten, lateBase], rowIndex) => {
      const index =
        slot < FORGOTTEN_SLOT
          ? base + slot
          : slot === FORGOTTEN_SLOT
            ? forgotten
            : lateBase + (slot - FIRST_LATE_SLOT);

      const value = counter(index);
      if (value === 0) return;

      const state: CellState = value & 2 ? 2 : 1;
      const markId = ROW_MARK_IDS[rowIndex];
      if (markId === null) {
        // Ultra Greed / Greedier share a slot: a Greedier clear implies the Greed mark too.
        row["ultra_greed"] = state;
        if (value & 2) row["ultra_greedier"] = 2;
      } else {
        row[markId] = state;
      }
    });

    const cells = Object.values(row);
    if (cells.length === 0) return;
    marks[charId] = row;
    earned += cells.length;
    hard += cells.filter((v) => v === 2).length;
  });

  return { marks, earned, hard };
}

/**
 * The game's own integrity check: a CRC-32 variant over everything between the header and the
 * trailing checksum word. Its table is the standard reflected CRC-32 table (0xEDB88320) with a
 * perturbation of the high byte that is XOR-linear in the index, so eight constants rebuild it.
 */
function checksumMatches(view: DataView): boolean {
  const end = view.byteLength - 4;
  if (end <= CHECKSUM_START) return false;

  let crc = ~0xfedcba76;
  for (let i = CHECKSUM_START; i < end; i++) {
    crc = (crcTable()[(crc & 0xff) ^ view.getUint8(i)] ^ (crc >>> 8)) | 0;
  }
  return (~crc >>> 0) === view.getUint32(end, true);
}

let table: Int32Array | undefined;

function crcTable(): Int32Array {
  if (table !== undefined) return table;

  const basis = [0x7e000000, 0xfc000000, 0xf8000000, 0xf0000000, 0xe0000000, 0xc0000000, 0x80000000, 0];
  table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    for (let bit = 0; bit < 8; bit++) if ((i >> bit) & 1) c ^= basis[bit]!;
    table[i] = c | 0;
  }
  return table;
}

function asciiAt(buffer: ArrayBuffer, start: number, length: number): string {
  return String.fromCharCode(...new Uint8Array(buffer, start, Math.min(length, buffer.byteLength)));
}
