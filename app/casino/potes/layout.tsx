import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Entre potes",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
