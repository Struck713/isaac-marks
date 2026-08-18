import { For, createSignal } from "solid-js";
import { MARKS } from "../data.ts";
import {
  importState,
  reset,
  setFilter,
  setHideCompleted,
  setMarkMode,
  snapshot,
  state,
  totals,
  type CharFilter,
} from "../store.ts";

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

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "isaac-completion-marks.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported isaac-completion-marks.json");
  };

  const importJson = async (file: File) => {
    try {
      const ok = importState(JSON.parse(await file.text()));
      flash(ok ? `Imported ${file.name}` : `${file.name} is not a marks export`);
    } catch {
      flash(`Could not read ${file.name}`);
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
            <span class="progress-fill" style={{ width: `${(totals().earned / totals().total) * 100}%` }} />
            <span class="progress-fill hard" style={{ width: `${(totals().hard / totals().total) * 100}%` }} />
          </span>
        </div>

        <div class="spacer" />

        <button type="button" onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" onClick={() => fileInput.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void importJson(f);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          class="danger"
          onClick={() => {
            if (confirm("Clear every completion mark? This cannot be undone.")) {
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
          <span>Hide fully-Hard characters</span>
        </label>

        <div class="spacer" />
        <span class="hint">
          Click a cell to cycle <em>none → Normal → Hard</em> · right-click to go back · click a
          header to fill a whole row or column
        </span>
      </div>

      <p class="note">
        {MARKS.length} marks × 34 characters. Some marks can't be earned in the same run —
        Satan/The Lamb vs. Isaac/???, and Mother vs. The Beast — so those take separate runs.
        The tracker doesn't enforce that; mark whatever you've done.
      </p>

      <div class="flash" classList={{ show: message() !== "" }} role="status">
        {message()}
      </div>
    </div>
  );
}
