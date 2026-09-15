import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connecte-toi à IttolecHub avec tes 6 mots ou avec Discord.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
