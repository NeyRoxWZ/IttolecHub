/**
 * Ezoic ads, wired the way their Next.js App Router guide describes: commands
 * are queued on window.ezstandalone.cmd and run once sa.min.js has loaded.
 * https://docs.ezoic.com/docs/ezoicadsadvanced/nextjs/
 */

declare global {
  interface Window {
    ezstandalone?: {
      cmd: Array<() => void>;
      showAds: (...ids: number[]) => void;
      destroyPlaceholders: (...ids: number[]) => void;
    };
  }
}

/** Pages without ads: the casino, until Ezoic and Google have reviewed it. */
export function adsAllowedOn(pathname: string): boolean {
  return !pathname.startsWith('/casino');
}

export function runEzoic(fn: () => void) {
  if (typeof window === 'undefined') return;
  window.ezstandalone = window.ezstandalone || ({ cmd: [] } as unknown as NonNullable<Window['ezstandalone']>);
  window.ezstandalone.cmd = window.ezstandalone.cmd || [];
  window.ezstandalone.cmd.push(fn);
}
