import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Cagnotte de groupe",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
