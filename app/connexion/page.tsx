'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConnexionPage() {
  const [pseudo, setPseudo] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginDiscord, setUserLocally, user, loading: authLoading } = useAuth();

  const nextPath = useMemo(() => {
    const fromQuery = searchParams.get('next');
    if (fromQuery && fromQuery.startsWith('/')) return fromQuery;

    try {
      const stored = sessionStorage.getItem('itollec_next_path');
      if (stored && stored.startsWith('/')) return stored;
    } catch {}

    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin) {
        const p = `${ref.pathname}${ref.search}${ref.hash}`;
        if (p.startsWith('/')) return p;
      }
    } catch {}

    return '/';
  }, [searchParams]);

  useEffect(() => {
    try {
      sessionStorage.setItem('itollec_next_path', nextPath);
    } catch {}
  }, [nextPath]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    router.replace(nextPath);
  }, [authLoading, nextPath, router, user]);

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
      router.push(nextPath);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent px-3 sm:px-6 pt-3 sm:pt-5 pb-10">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <Link
            href="/"
            aria-label="Retour"
            className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </Link>
        </div>

        <div className="max-w-xl mx-auto bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-brutal">
          <div className="flex items-center justify-between h-12">
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Connexion</h1>
            <div className="shrink-0 rounded-lg border-[3px] border-brand-border bg-brand-inner p-2">
              <span className="font-display text-tx-base">ID</span>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <button
              type="button"
              onClick={() => loginDiscord(nextPath)}
              className="w-full h-14 rounded-xl font-display text-xl border-[3px] border-brand-border bg-[#5865F2] text-white shadow-[inset_0_-5px_0_#3C45C4,0_4px_0_#05061A] active:translate-y-[3px] transition-transform flex items-center justify-center gap-3"
            >
              <svg width="22" height="22" viewBox="0 0 256 199" aria-hidden="true" className="shrink-0">
                <path
                  fill="currentColor"
                  d="M216.9 16.5A208.6 208.6 0 0 0 164.6 0a144 144 0 0 0-6.9 14.2 193.4 193.4 0 0 0-58.9 0A144 144 0 0 0 91.9 0a207.8 207.8 0 0 0-52.2 16.5C6.8 67.9-2.1 118 2.4 167.2a210.7 210.7 0 0 0 63.6 32.7 160.5 160.5 0 0 0 13.7-22.3 134.5 134.5 0 0 1-21.6-10.4c1.8-1.3 3.6-2.7 5.3-4.1a150.6 150.6 0 0 0 129.2 0c1.7 1.4 3.5 2.8 5.3 4.1a134.3 134.3 0 0 1-21.6 10.4 160.5 160.5 0 0 0 13.7 22.3 210.6 210.6 0 0 0 63.6-32.7c5.3-57.1-9-107.2-36.4-150.7ZM85.5 135.1c-12.6 0-23-11.5-23-25.6s10.2-25.6 23-25.6c12.8 0 23.2 11.5 23 25.6 0 14.1-10.2 25.6-23 25.6Zm85 0c-12.6 0-23-11.5-23-25.6s10.2-25.6 23-25.6c12.8 0 23.2 11.5 23 25.6 0 14.1-10.2 25.6-23 25.6Z"
                />
              </svg>
              Se connecter avec Discord
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-[2px] bg-brand-border" />
              <div className="text-sm font-black text-tx-secondary">Passphrase</div>
              <div className="flex-1 h-[2px] bg-brand-border" />
            </div>

            <form onSubmit={handlePassphraseLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-black text-tx-secondary">
                  Ton pseudo
                </label>
                <input
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="PseudoCool"
                  className="w-full h-12 rounded-lg bg-brand-inner border-[3px] border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-tx-secondary">
                  Tes 6 mots (dans l&apos;ordre)
                </label>
                <input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="pomme chat voiture arbre ..."
                  className="w-full h-12 rounded-lg bg-brand-inner border-[3px] border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full h-14 rounded-xl font-display text-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <div className="text-center text-sm font-black text-tx-secondary">
              Pas encore de compte ?{' '}
              <Link href="/creer-compte" className="text-tx-base hover:text-accent-primary transition-colors">
                Créer un compte
              </Link>
            </div>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full h-12 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform"
            >
              Revenir à l&apos;accueil
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
