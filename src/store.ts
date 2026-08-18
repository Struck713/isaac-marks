import { createEffect } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { CHARACTERS, MARKS, type CellState } from "./data.ts";

const STORAGE_KEY = "isaac-completion-marks";
const VERSION = 1;

export type CharFilter = "all" | "untainted" | "tainted";

export interface UiState {
  /** false = Unlock/Guide view, true = Completion Mark view. */
  markMode: boolean;
  filter: CharFilter;
  /** Hide characters whose 13 marks are all at Hard. */
  hideCompleted: boolean;
}

export interface Persisted {
  version: number;
  updatedAt: string;
  ui: UiState;
  /** Sparse — only non-zero cells are stored. */
  marks: Record<string, Record<string, CellState>>;
}

const CHAR_IDS = new Set(CHARACTERS.map((c) => c.id));
const MARK_IDS = new Set(MARKS.map((m) => m.id));

export const TOTAL_CELLS = CHARACTERS.length * MARKS.length;

function emptyState(): Persisted {
  return {
    version: VERSION,
    updatedAt: new Date().toISOString(),
    ui: { markMode: false, filter: "all", hideCompleted: false },
    marks: {},
  };
}

/**
 * Validate an arbitrary parsed blob into a Persisted value. Unknown character/mark ids and
 * out-of-range states are dropped rather than thrown, so a corrupt or outdated file can never
 * break the UI.
 */
export function sanitize(raw: unknown): Persisted {
  const fresh = emptyState();
  if (!raw || typeof raw !== "object") return fresh;
  const input = raw as Partial<Persisted>;

  if (input.ui && typeof input.ui === "object") {
    fresh.ui.markMode = input.ui.markMode === true;
    if (input.ui.filter === "untainted" || input.ui.filter === "tainted") fresh.ui.filter = input.ui.filter;
    fresh.ui.hideCompleted = input.ui.hideCompleted === true;
  }

  fresh.marks = sanitizeMarks(input.marks);
  return fresh;
}

/** The marks half of `sanitize`, on its own — imports supply marks but no UI settings. */
function sanitizeMarks(raw: unknown): Persisted["marks"] {
  const clean: Persisted["marks"] = {};
  if (!raw || typeof raw !== "object") return clean;

  for (const [charId, row] of Object.entries(raw)) {
    if (!CHAR_IDS.has(charId) || !row || typeof row !== "object") continue;
    for (const [markId, value] of Object.entries(row)) {
      if (!MARK_IDS.has(markId)) continue;
      if (value !== 1 && value !== 2) continue; // 0 / junk = not earned
      (clean[charId] ??= {})[markId] = value;
    }
  }
  return clean;
}

function loadState(): Persisted {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return emptyState();
    return sanitize(JSON.parse(text));
  } catch {
    return emptyState(); // never throw into the UI
  }
}

const [state, setState] = createStore<Persisted>(loadState());

export { state };

// Autosave: re-runs whenever any tracked field changes.
createEffect(() => {
  const snapshot: Persisted = {
    version: VERSION,
    updatedAt: new Date().toISOString(),
    ui: { ...state.ui },
    marks: JSON.parse(JSON.stringify(state.marks)),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode / quota — the app still works for this session */
  }
});

export function cell(charId: string, markId: string): CellState {
  return state.marks[charId]?.[markId] ?? 0;
}

function write(charId: string, markId: string, next: CellState) {
  setState(
    produce((s) => {
      if (next === 0) {
        const row = s.marks[charId];
        if (!row) return;
        delete row[markId]; // keep storage sparse
        if (Object.keys(row).length === 0) delete s.marks[charId];
      } else {
        (s.marks[charId] ??= {})[markId] = next;
      }
    }),
  );
}

export const setCell = write;

/** none → normal → hard → none */
export function cycle(charId: string, markId: string) {
  write(charId, markId, ((cell(charId, markId) + 1) % 3) as CellState);
}

/** none → hard → normal → none */
export function cycleBack(charId: string, markId: string) {
  write(charId, markId, ((cell(charId, markId) + 2) % 3) as CellState);
}

/** Set every mark of one character, or clear them all. */
export function setCharacter(charId: string, value: CellState) {
  setState(
    produce((s) => {
      if (value === 0) delete s.marks[charId];
      else for (const m of MARKS) (s.marks[charId] ??= {})[m.id] = value;
    }),
  );
}

/** Set one mark across every character, or clear it everywhere. */
export function setMarkRow(markId: string, value: CellState) {
  setState(
    produce((s) => {
      for (const c of CHARACTERS) {
        if (value === 0) {
          const row = s.marks[c.id];
          if (!row) continue;
          delete row[markId];
          if (Object.keys(row).length === 0) delete s.marks[c.id];
        } else {
          (s.marks[c.id] ??= {})[markId] = value;
        }
      }
    }),
  );
}

export function setMarkMode(on: boolean) {
  setState("ui", "markMode", on);
}
export function setFilter(f: CharFilter) {
  setState("ui", "filter", f);
}
export function setHideCompleted(on: boolean) {
  setState("ui", "hideCompleted", on);
}

export function reset() {
  setState(reconcile(emptyState()));
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Replace every mark with a set read out of a game save file. View settings (mark mode, filters)
 * belong to the browser, not the save, so they are left alone.
 */
export function importMarks(marks: Persisted["marks"]) {
  setState("marks", reconcile(sanitizeMarks(marks)));
}

export function countsFor(charId: string) {
  let earned = 0;
  let hard = 0;
  for (const m of MARKS) {
    const v = cell(charId, m.id);
    if (v > 0) earned++;
    if (v === 2) hard++;
  }
  return { earned, hard, total: MARKS.length };
}

export function totals() {
  let earned = 0;
  let hard = 0;
  for (const c of CHARACTERS) {
    const n = countsFor(c.id);
    earned += n.earned;
    hard += n.hard;
  }
  return { earned, hard, total: TOTAL_CELLS };
}
