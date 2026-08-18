import { Show } from "solid-js";
import { QUALITIES, UNLOCKS, itemSlug, type Character, type Mark } from "../data.ts";
import { itemSprite, markIcon } from "../assets.ts";
import { cell, cycle, cycleBack, state } from "../store.ts";
import { Sprite } from "./Sprite.tsx";

const STATE_NAME = ["not earned", "Normal", "Hard"] as const;

/**
 * One (character, mark) cell. It answers both questions at once:
 *   · what does this unlock?  → the quality-coloured background + item sprite (guide mode)
 *   · have I done it?         → the tri-state completion treatment, in both modes
 */
export function Cell(props: { char: Character; mark: Mark; firstTainted: boolean }) {
  const unlock = () => UNLOCKS[props.char.id]?.[props.mark.id];
  const value = () => cell(props.char.id, props.mark.id);
  const guide = () => !state.ui.markMode;

  const title = () => {
    const u = unlock();
    const what = u ? `${u.item} — ${QUALITIES[u.quality].label}` : "No unlock";
    return `${props.char.label} · ${props.mark.label}\n${what}\n${STATE_NAME[value()]}`;
  };

  const background = () => {
    const u = unlock();
    return guide() && u ? QUALITIES[u.quality].color : undefined;
  };

  return (
    <div
      class="cell"
      classList={{
        "state-none": value() === 0,
        "state-normal": value() === 1,
        "state-hard": value() === 2,
        "no-unlock": guide() && !unlock(),
        "mark-mode": !guide(),
        "col-tainted-start": props.firstTainted,
      }}
      style={background() ? { "background-color": background() } : undefined}
      role="gridcell"
      tabindex="0"
      aria-label={`${props.char.label}, ${props.mark.label}: ${STATE_NAME[value()]}`}
      title={title()}
      onClick={() => cycle(props.char.id, props.mark.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        cycleBack(props.char.id, props.mark.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycle(props.char.id, props.mark.id);
        }
      }}
    >
      <Show
        when={guide()}
        fallback={
          <Sprite class="cell-art mark-art" src={markIcon(props.mark.id)} alt={props.mark.label} />
        }
      >
        <Show when={unlock()}>
          {(u) => (
            <Sprite class="cell-art" src={itemSprite(itemSlug(u().wikiFile))} alt={u().item} />
          )}
        </Show>
      </Show>
      <Show when={value() > 0}>
        <span class="badge" aria-hidden="true">
          ✓
        </span>
      </Show>
    </div>
  );
}
