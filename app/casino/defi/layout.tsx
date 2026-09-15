import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Défi du jour",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
