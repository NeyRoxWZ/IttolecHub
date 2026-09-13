import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Frenly Pêche — IttolecHub',
  robots: { index: false, follow: false },
};

export default function PecheLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
