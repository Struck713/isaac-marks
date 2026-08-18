import { characterIcon } from "../assets.ts";
import { type Character } from "../data.ts";
import { countsFor, setCharacter } from "../store.ts";
import { Sprite } from "./Sprite.tsx";

export function CharacterHeader(props: {
  char: Character;
  firstTainted: boolean;
}) {
  const counts = () => countsFor(props.char.id);

  const bulk = () => {
    const { earned, hard, total } = counts();
    if (hard === total) {
      if (confirm(`Clear all ${total} marks for ${props.char.label}?`))
        setCharacter(props.char.id, 0);
    } else if (earned === total) {
      setCharacter(props.char.id, 2);
    } else {
      setCharacter(props.char.id, 1);
    }
  };

  return (
    <div
      class="head head-char"
      classList={{
        tainted: props.char.tainted,
        "col-tainted-start": props.firstTainted,
      }}
      role="columnheader"
      tabindex="0"
      title={`${props.char.label}\n${counts().earned}/${counts().total} marks · ${counts().hard} on Hard\nClick to fill or clear this column`}
      onClick={bulk}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          bulk();
        }
      }}
    >
      <Sprite
        class="head-art"
        src={characterIcon(props.char.id)}
        alt={props.char.label}
      />
      <span class="head-label">
        {props.char.tainted
          ? props.char.label.replace(/^Tainted /, "")
          : props.char.label}
      </span>
      <span
        class="head-count"
        classList={{ done: counts().earned === counts().total }}
      >
        {counts().earned}/{counts().total}
      </span>
    </div>
  );
}
