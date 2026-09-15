import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Frenly Pass",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
