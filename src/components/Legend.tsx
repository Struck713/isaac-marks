import { For } from "solid-js";
import { QUALITIES, type QualityKey } from "../data.ts";

const ORDER: QualityKey[] = [
  "q4",
  "q3",
  "q2",
  "q1",
  "q0",
  "trinket",
  "coop",
  "character",
  "feature",
  "consumable",
];

export function Legend() {
  return (
    <div class="legend">
      <div class="legend-block">
        <h2>Unlocks</h2>
        <ul class="legend-items">
          <For each={ORDER}>
            {(k) => (
              <li>
                <span
                  class="swatch"
                  style={{ "background-color": QUALITIES[k].color }}
                />
                {QUALITIES[k].label}
              </li>
            )}
          </For>
          <li>
            <span class="swatch swatch-none" />
            No unlock
          </li>
        </ul>
      </div>

      <div class="legend-block">
        <h2>Progression</h2>
        <ul class="legend-items">
          <li>
            <span class="state-chip cell state-none" />
            Not earned
          </li>
          <li>
            <span class="state-chip cell state-normal">
              <span class="badge">✓</span>
            </span>
            Normal mode
          </li>
          <li>
            <span class="state-chip cell state-hard">
              <span class="badge">✓</span>
            </span>
            Hard mode
          </li>
        </ul>
      </div>
    </div>
  );
}
