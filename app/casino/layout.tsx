import type { ReactNode } from 'react';
import CelebrationLayer from './_components/CelebrationLayer';

/** Mounted once so any casino page can fire a celebration without wiring. */
export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CelebrationLayer />
    </>
  );
}
