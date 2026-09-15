import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "FlagGuessr",
  // A personal or one-off page: nothing for search engines to list.
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
