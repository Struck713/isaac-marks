import { For, createMemo } from "solid-js";
import { CHARACTERS, MARKS } from "../data.ts";
import { countsFor, state } from "../store.ts";
import { BossHeader } from "./BossHeader.tsx";
import { Cell } from "./Cell.tsx";
import { CharacterHeader } from "./HeaderRow.tsx";

/** The 34 × 13 grid. Everything is generated from data.ts — nothing is hardcoded per cell. */
export function Grid() {
  const visible = createMemo(() =>
    CHARACTERS.filter((c) => {
      if (state.ui.filter === "untainted" && c.tainted) return false;
      if (state.ui.filter === "tainted" && !c.tainted) return false;
      if (state.ui.hideCompleted && countsFor(c.id).hard === MARKS.length) return false;
      return true;
    }),
  );

  const firstTaintedId = createMemo(() => visible().find((c) => c.tainted)?.id);

  return (
    <div class="grid-scroll">
      <div
        class="grid"
        role="grid"
        aria-label="Completion marks"
        style={{ "grid-template-columns": `var(--rowhead-w) repeat(${visible().length}, var(--cell-w))` }}
      >
        <div class="head head-corner">
          <span>Bosses \ Characters</span>
        </div>
        <For each={visible()}>
          {(c) => <CharacterHeader char={c} firstTainted={c.id === firstTaintedId()} />}
        </For>

        <For each={MARKS}>
          {(m) => (
            <>
              <BossHeader mark={m} />
              <For each={visible()}>
                {(c) => <Cell char={c} mark={m} firstTainted={c.id === firstTaintedId()} />}
              </For>
            </>
          )}
        </For>
      </div>
    </div>
  );
}
