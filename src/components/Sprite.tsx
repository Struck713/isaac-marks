import { Show, createSignal } from "solid-js";

export function Sprite(props: {
  src: string;
  alt: string;
  class?: string;
  fallbackClass?: string;
}) {
  const [broken, setBroken] = createSignal(false);
  return (
    <Show
      when={!broken()}
      fallback={
        <span
          class={props.fallbackClass ?? "sprite-fallback"}
          aria-label={props.alt}
        >
          {props.alt}
        </span>
      }
    >
      <img
        class={props.class}
        src={props.src}
        alt={props.alt}
        draggable={false}
        onError={() => setBroken(true)}
      />
    </Show>
  );
}
