import { For, createSignal } from "solid-js";
import {
  importMarks,
  reset,
  setFilter,
  setHideCompleted,
  setMarkMode,
  state,
  totals,
  type CharFilter,
} from "../store.ts";
import { SaveFileError, readSaveFile } from "../saveFile.ts";

const FILTERS: { id: CharFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "untainted", label: "Untainted" },
  { id: "tainted", label: "Tainted" },
];

export function Toolbar() {
  const [message, setMessage] = createSignal("");
  let fileInput!: HTMLInputElement;

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  };

  /** Read the marks straight out of the game's own save file — nothing is written back. */
  const importSave = async (file: File) => {
    try {
      const save = readSaveFile(await file.arrayBuffer());
      importMarks(save.marks);
      flash(
        `Loaded ${save.earned} marks (${save.hard} on Hard) from ${file.name}` +
          (save.checksumValid ? "" : " — its checksum does not match, so it may be edited"),
      );
    } catch (error) {
      flash(
        error instanceof SaveFileError
          ? error.message
          : `Could not read ${file.name}`,
      );
    }
  };

  return (
    <div class="toolbar">
      <div class="toolbar-row">
        <label class="switch">
          <input
            type="checkbox"
            checked={state.ui.markMode}
            onChange={(e) => setMarkMode(e.currentTarget.checked)}
          />
          <span>Completion Mark Mode</span>
        </label>

        <div class="progress" role="status">
          <span>
            Marks <strong>{totals().earned}</strong>/{totals().total}
          </span>
          <span class="progress-hard">
            Hard <strong>{totals().hard}</strong>
          </span>
          <span class="progress-bar" aria-hidden="true">
            <span
              class="progress-fill"
              style={{ width: `${(totals().earned / totals().total) * 100}%` }}
            />
            <span
              class="progress-fill hard"
              style={{ width: `${(totals().hard / totals().total) * 100}%` }}
            />
          </span>
        </div>

        <div class="spacer" />

        <button
          type="button"
          onClick={() => fileInput.click()}
          title="Fill the grid from a Repentance persistentgamedata .dat file"
        >
          Import Save File
        </button>
        <input
          ref={fileInput}
          class="visually-hidden"
          type="file"
          accept=".dat"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void importSave(f);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          class="danger"
          onClick={() => {
            if (
              confirm("Clear every completion mark? This cannot be undone.")
            ) {
              reset();
              flash("All marks cleared");
            }
          }}
        >
          Reset
        </button>
      </div>

      <div class="toolbar-row">
        <span class="group-label">Characters</span>
        <div class="segmented" role="group" aria-label="Character filter">
          <For each={FILTERS}>
            {(f) => (
              <button
                type="button"
                classList={{ active: state.ui.filter === f.id }}
                aria-pressed={state.ui.filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            )}
          </For>
        </div>

        <label class="switch">
          <input
            type="checkbox"
            checked={state.ui.hideCompleted}
            onChange={(e) => setHideCompleted(e.currentTarget.checked)}
          />
          <span>Hide fully completed characters</span>
        </label>

        <div class="spacer" />
        <span class="hint">
          Click a cell to cycle: <em>none, normal and hard</em> · right-click to
          go back · click a header to fill a whole row or column
        </span>
      </div>

      <div class="flash" classList={{ show: message() !== "" }} role="status">
        {message()}
      </div>
    </div>
  );
}
