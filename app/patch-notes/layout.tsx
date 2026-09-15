import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Patch notes",
  description: "Toutes les nouveautés, corrections et rééquilibrages d’IttolecHub, version après version.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
