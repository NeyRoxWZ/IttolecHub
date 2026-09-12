import { redirect } from 'next/navigation';

/** Progression was split into the rail's chest and missions modals, the pass page and the inventory. */
export default function KrashProgressionRedirect() {
  redirect('/krash/pass');
}
