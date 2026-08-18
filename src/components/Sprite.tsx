import { Show, createSignal } from "solid-js";

/**
 * An <img> from the local assets bundle with a pure-text fallback.
 *
 * A broken image here means the bundle is incomplete — the fix is `npm run scrape`, so the
 * fallback deliberately does NOT reach out to the wiki (or anywhere else); it just keeps the
 * grid readable by showing the label instead.
 */
export function Sprite(props: { src: string; alt: string; class?: string; fallbackClass?: string }) {
  const [broken, setBroken] = createSignal(false);
  return (
    <Show
      when={!broken()}
      fallback={
        <span class={props.fallbackClass ?? "sprite-fallback"} aria-label={props.alt}>
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
