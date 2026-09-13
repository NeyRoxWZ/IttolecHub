/**
 * The shared pieces of the "Brawl" look, so every screen builds its buttons
 * and panels the same way: black outline, bright fill, a darker bottom edge
 * that reads as relief, and a press that sinks into it.
 */

const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-brand-border font-display tracking-wide transition-transform active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-primary';

export const BRAWL = {
  btn: BTN,
  yellow: `${BTN} bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]`,
  green: `${BTN} bg-accent-success text-brand-bg shadow-[inset_0_-5px_0_#1E9A55,0_4px_0_#05061A]`,
  pink: `${BTN} bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A]`,
  blue: `${BTN} bg-accent-info text-white shadow-[inset_0_-5px_0_#2F5BD0,0_4px_0_#05061A]`,
  dark: `${BTN} bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] hover:bg-[#333A80]`,
  /** A panel on the page. */
  panel: 'bg-brand-card border-4 border-brand-border rounded-[22px] shadow-[0_6px_0_#05061A]',
  /** A status pill in a header: balance, level, streak. */
  pill: 'h-12 inline-flex items-center gap-2 rounded-2xl bg-brand-bg border-[3px] border-brand-border px-2 font-display text-lg text-white',
  /** A small round-cornered icon square with relief. */
  iconTile: 'relative inline-flex items-center justify-center rounded-2xl border-[3px] border-brand-border',
};

/**
 * A choice among several (bet type, colour, number of mines…): raised yellow
 * when picked, a darker tile otherwise.
 */
export function brawlChoice(selected: boolean): string {
  return [
    'rounded-xl border-[3px] border-brand-border font-display transition-transform active:translate-y-[3px] disabled:opacity-50 disabled:active:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-white',
    selected
      ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]'
      : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_4px_0_#05061A] hover:bg-[#333A80]',
  ].join(' ');
}

/** Cover colours cycled through lists of games, with the matching shade for the bottom edge. */
export const BRAWL_SWATCHES = [
  { fill: '#FF4F8B', shade: '#C92D63' },
  { fill: '#8B3DFF', shade: '#6526C9' },
  { fill: '#1FB866', shade: '#158A4B' },
  { fill: '#FF8A1F', shade: '#CC6508' },
  { fill: '#3B6BFF', shade: '#2A4FC4' },
];
