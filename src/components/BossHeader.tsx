import { CHARACTERS, type Mark } from "../data.ts";
import { bossImage } from "../assets.ts";
import { cell, setMarkRow } from "../store.ts";
import { Sprite } from "./Sprite.tsx";

/** One sticky boss row header. Clicking it fills or clears that whole row. */
export function BossHeader(props: { mark: Mark }) {
  const counts = () => {
    let earned = 0;
    let hard = 0;
    for (const c of CHARACTERS) {
      const v = cell(c.id, props.mark.id);
      if (v > 0) earned++;
      if (v === 2) hard++;
    }
    return { earned, hard, total: CHARACTERS.length };
  };

  const bulk = () => {
    const { earned, hard, total } = counts();
    if (hard === total) {
      if (confirm(`Clear the ${props.mark.label} mark for all ${total} characters?`)) setMarkRow(props.mark.id, 0);
    } else if (earned === total) {
      setMarkRow(props.mark.id, 2);
    } else {
      setMarkRow(props.mark.id, 1);
    }
  };

  return (
    <div
      class="head head-boss"
      role="rowheader"
      tabindex="0"
      title={`${props.mark.label}\n${counts().earned}/${counts().total} characters · ${counts().hard} on Hard\nClick to fill or clear this row`}
      onClick={bulk}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          bulk();
        }
      }}
    >
      <Sprite class="boss-art" src={bossImage(props.mark.id)} alt={props.mark.label} />
      <span class="boss-label">{props.mark.label}</span>
    </div>
  );
}
