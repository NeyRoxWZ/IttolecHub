/**
 * Asks a guest to sign in, from anywhere in the casino: the prompt itself
 * (components/SignInPrompt) is mounted once in the layout and listens.
 *
 * Guests can play every game with a local balance; what needs an account is
 * what gets saved or given out — daily rewards, chests, cosmetics, the pass,
 * missions, the shop.
 */
export const SIGN_IN_EVENT = 'itollec:ask-sign-in';

export function askToSignIn(reason: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIGN_IN_EVENT, { detail: reason }));
}
