/*
 * Look Explorer store.
 *
 * Owns the three presentation axes — palette (color), font (typography), and
 * layout (shape) — and nothing about gameplay. Each axis maps 1:1 to a
 * data-attribute on <html> that the presets in styles/themes.css key off, so
 * this store's only job is: hold the current choice, stamp the attribute, and
 * persist it.
 *
 * Kept deliberately self-contained so it can either be stripped out after the
 * design exploration or graduate into the real Settings panel unchanged.
 */

// `group` drives the <optgroup> headings in the Explorer dropdowns; items keep
// their array order within a group.
export type Option = { id: string; name: string; group: string };

// Within each group, dark palettes are listed first, then light ones.
export const PALETTES = [
  // Core — dark
  { id: 'modern-dark', name: 'Modern Dark', group: 'Core' },
  { id: 'nord', name: 'Nord (dark)', group: 'Core' },
  { id: 'dungeon', name: 'Dungeon', group: 'Core' },
  { id: 'terminal', name: 'Terminal Green', group: 'Core' },
  { id: 'amber', name: 'Amber CRT', group: 'Core' },
  // Core — light
  { id: 'modern-light', name: 'Modern Light', group: 'Core' },
  { id: 'paper', name: 'Paper (light)', group: 'Core' },
  { id: 'parchment', name: 'Parchment', group: 'Core' },
  // Popular editor themes — dark
  { id: 'solarized-dark', name: 'Solarized Dark', group: 'Popular themes' },
  { id: 'gruvbox', name: 'Gruvbox', group: 'Popular themes' },
  { id: 'dracula', name: 'Dracula', group: 'Popular themes' },
  { id: 'rose-pine', name: 'Rosé Pine', group: 'Popular themes' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', group: 'Popular themes' },
  { id: 'tokyo-night', name: 'Tokyo Night', group: 'Popular themes' },
  { id: 'everforest', name: 'Everforest', group: 'Popular themes' },
  { id: 'night-owl', name: 'Night Owl', group: 'Popular themes' },
  { id: 'ayu-dark', name: 'Ayu Dark', group: 'Popular themes' },
  { id: 'ayu-mirage', name: 'Ayu Mirage', group: 'Popular themes' },
  { id: 'one-dark', name: 'One Dark', group: 'Popular themes' },
  { id: 'kanagawa', name: 'Kanagawa', group: 'Popular themes' },
  { id: 'github-dark', name: 'GitHub Dark', group: 'Popular themes' },
  { id: 'monokai', name: 'Monokai', group: 'Popular themes' },
  { id: 'monokai-pro', name: 'Monokai Pro', group: 'Popular themes' },
  { id: 'palenight', name: 'Palenight', group: 'Popular themes' },
  { id: 'oceanic-next', name: 'Oceanic Next', group: 'Popular themes' },
  { id: 'cobalt2', name: 'Cobalt2', group: 'Popular themes' },
  { id: 'zenburn', name: 'Zenburn', group: 'Popular themes' },
  { id: 'synthwave', name: "Synthwave '84", group: 'Popular themes' },
  { id: 'poimandres', name: 'Poimandres', group: 'Popular themes' },
  { id: 'nightfly', name: 'Nightfly', group: 'Popular themes' },
  { id: 'horizon', name: 'Horizon', group: 'Popular themes' },
  { id: 'royal', name: 'Royal', group: 'Popular themes' },
  { id: 'blood-moon', name: 'Blood Moon', group: 'Popular themes' },
  { id: 'vaporwave', name: 'Vaporwave', group: 'Popular themes' },
  // Popular editor themes — light
  { id: 'solarized-light', name: 'Solarized Light', group: 'Popular themes' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', group: 'Popular themes' },
  { id: 'ayu-light', name: 'Ayu Light', group: 'Popular themes' },
  { id: 'github-light', name: 'GitHub Light', group: 'Popular themes' },
  { id: 'frost', name: 'Frost', group: 'Popular themes' },
  { id: 'sepia', name: 'Sepia', group: 'Popular themes' },
  { id: 'high-contrast', name: 'High Contrast', group: 'Popular themes' },
  { id: 'mono-grey', name: 'Mono Grey', group: 'Popular themes' },
  // Environments — dark
  { id: 'midnight', name: 'Midnight (near-black)', group: 'Environments' },
  { id: 'forest', name: 'Forest', group: 'Environments' },
  { id: 'ocean', name: 'Ocean', group: 'Environments' },
  { id: 'autumn', name: 'Autumn', group: 'Environments' },
  // Environments — light
  { id: 'desert', name: 'Desert', group: 'Environments' },
  { id: 'alpine', name: 'Snowy Mountain', group: 'Environments' },
  { id: 'meadow', name: 'Grassy Field', group: 'Environments' },
] as const satisfies readonly Option[];

export const FONTS = [
  // Terminal & monospace
  { id: 'retro', name: 'Retro Terminal', group: 'Terminal & mono' },
  { id: 'plex-mono', name: 'IBM Plex Mono', group: 'Terminal & mono' },
  { id: 'jetbrains', name: 'JetBrains Mono', group: 'Terminal & mono' },
  { id: 'space-mono', name: 'Space Mono', group: 'Terminal & mono' },
  { id: 'fira-code', name: 'Fira Code', group: 'Terminal & mono' },
  { id: 'inconsolata', name: 'Inconsolata', group: 'Terminal & mono' },
  { id: 'sixtyfour', name: 'Sixtyfour (C64)', group: 'Terminal & mono' },
  { id: 'dot-matrix', name: 'Dot Matrix', group: 'Terminal & mono' },
  // 8-bit / pixel
  { id: 'pixel', name: 'Pixel Arcade', group: '8-bit / pixel' },
  { id: 'pixelify', name: 'Pixelify', group: '8-bit / pixel' },
  { id: 'jersey', name: 'Jersey', group: '8-bit / pixel' },
  { id: 'pixel-mono', name: '8-Bit Mono', group: '8-bit / pixel' },
  // Serif & medieval
  { id: 'serif', name: 'Cozy Serif', group: 'Serif & medieval' },
  { id: 'im-fell', name: 'Antique Serif', group: 'Serif & medieval' },
  { id: 'cormorant', name: 'Elegant Serif', group: 'Serif & medieval' },
  { id: 'medieval', name: 'Storybook Medieval', group: 'Serif & medieval' },
  { id: 'uncial', name: 'Uncial', group: 'Serif & medieval' },
  { id: 'blackletter', name: 'Blackletter', group: 'Serif & medieval' },
] as const satisfies readonly Option[];

export const LAYOUTS = [
  { id: 'classic', name: 'Classic', group: 'Layout' },
  { id: 'flat', name: 'Flat', group: 'Layout' },
  { id: 'soft', name: 'Soft Cards', group: 'Layout' },
  { id: 'elevated', name: 'Elevated', group: 'Layout' },
] as const satisfies readonly Option[];

type PaletteId = (typeof PALETTES)[number]['id'];
type FontId = (typeof FONTS)[number]['id'];
type LayoutId = (typeof LAYOUTS)[number]['id'];

const KEYS = {
  palette: 'cc:palette',
  font: 'cc:font',
  layout: 'cc:layout',
  accentBorder: 'cc:accent-border',
} as const;

function isId<T extends readonly Option[]>(opts: T, v: string | null): v is T[number]['id'] {
  return v != null && opts.some((o) => o.id === v);
}

function createLookStore() {
  // Migrate the original light/dark toggle into the palette axis.
  const legacyTheme = localStorage.getItem('cc:theme');
  const defaultPalette: PaletteId = legacyTheme === 'light' ? 'paper' : 'nord';

  const savedPalette = localStorage.getItem(KEYS.palette);
  const savedFont = localStorage.getItem(KEYS.font);
  const savedLayout = localStorage.getItem(KEYS.layout);
  const savedAccentBorder = localStorage.getItem(KEYS.accentBorder);

  let palette = $state<PaletteId>(isId(PALETTES, savedPalette) ? savedPalette : defaultPalette);
  let font = $state<FontId>(isId(FONTS, savedFont) ? savedFont : 'retro');
  let layout = $state<LayoutId>(isId(LAYOUTS, savedLayout) ? savedLayout : 'classic');
  // The colored accent strip along the top of each panel; on by default.
  let accentBorder = $state<boolean>(savedAccentBorder !== 'off');

  /** Stamp all attributes and persist. Safe to call before mount. */
  function apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-font', font);
    root.setAttribute('data-layout', layout);
    root.setAttribute('data-accent-border', accentBorder ? 'on' : 'off');
    // The old toggle set data-theme; drop it so it can't fight data-palette.
    root.removeAttribute('data-theme');
    localStorage.setItem(KEYS.palette, palette);
    localStorage.setItem(KEYS.font, font);
    localStorage.setItem(KEYS.layout, layout);
    localStorage.setItem(KEYS.accentBorder, accentBorder ? 'on' : 'off');
  }

  return {
    get palette() {
      return palette;
    },
    set palette(v: PaletteId) {
      palette = v;
      apply();
    },
    get font() {
      return font;
    },
    set font(v: FontId) {
      font = v;
      apply();
    },
    get layout() {
      return layout;
    },
    set layout(v: LayoutId) {
      layout = v;
      apply();
    },
    get accentBorder() {
      return accentBorder;
    },
    set accentBorder(v: boolean) {
      accentBorder = v;
      apply();
    },
    apply,
  };
}

export const look = createLookStore();
