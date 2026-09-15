import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Crée ton compte IttolecHub gratuitement, avec un pseudo et 6 mots ou avec Discord.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
