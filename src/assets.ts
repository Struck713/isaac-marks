/**
 * Every image the app shows comes from the committed bundle in public/assets/.
 *
 * Vite copies public/ verbatim into dist/, so these paths resolve identically in dev
 * (`/assets/...`) and in the built app. Because vite.config.ts sets `base: "./"`, the
 * built dist/ also works when opened straight from file:// — BASE_URL carries the "./".
 *
 * There is deliberately no wiki URL anywhere in src/: the app makes zero network requests.
 */
const BASE = import.meta.env.BASE_URL;

export const characterIcon = (charId: string) => `${BASE}assets/characters/${charId}.png`;
export const bossImage = (markId: string) => `${BASE}assets/bosses/${markId}.png`;
export const markIcon = (markId: string) => `${BASE}assets/marks/${markId}.png`;
export const itemSprite = (slug: string) => `${BASE}assets/items/${slug}.png`;
