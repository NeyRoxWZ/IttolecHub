'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Link from 'next/link';
import { LogIn } from 'lucide-react';

export default function ConnexionPage() {
  const [pseudo, setPseudo] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { loginDiscord, setUserLocally } = useAuth();

  const handlePassphraseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo || !passphrase) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    const words = passphrase.trim().split(/\s+/);
    if (words.length !== 6) {
      toast.error('La passphrase doit contenir exactement 6 mots');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, words })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      setUserLocally(data.user);
      toast.success('Connecté avec succès !');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-brand-surface rounded-xl shadow-lg border border-white/5">
      <h1 className="text-2xl font-bold mb-6 text-center text-brand-primary">Connexion</h1>
      
      <div className="space-y-4">
        <Button onClick={loginDiscord} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white">
          Se connecter avec Discord
        </Button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-brand-surface px-2 text-white/50">Ou avec votre passphrase</span>
          </div>
        </div>

        <form onSubmit={handlePassphraseLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pseudo</label>
            <Input 
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Ton pseudo exact"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Les 6 mots (séparés par un espace)</label>
            <Input 
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="pomme chat voiture arbre..."
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-white/60">
          Pas encore de compte ?{' '}
          <Link href="/creer-compte" className="text-brand-primary hover:underline">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
