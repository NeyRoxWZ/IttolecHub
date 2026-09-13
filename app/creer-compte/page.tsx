'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { generatePassphrase } from '@/lib/words';
import { ArrowLeft, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ConsentBox, { DISCORD_CONSENT_KEY } from '@/components/ConsentBox';

export default function CreerComptePage() {
  const [pseudo, setPseudo] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'pseudo' | 'words'>('pseudo');
  const [accepted, setAccepted] = useState(false);
  const router = useRouter();
  const { setUserLocally, loginDiscord } = useAuth();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) {
      toast.error('Choisis un pseudo');
      return;
    }
    setWords(generatePassphrase());
    setStep('words');
  };

  const handleRegenerate = () => {
    setWords(generatePassphrase());
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(words.join(' '));
    toast.success('Mots copiés dans le presse-papier');
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, words })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur de création');
      }

      setUserLocally(data.user);
      toast.success('Compte créé avec succès ! Tu peux maintenant te connecter.');
      router.push('/connexion');
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
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Créer un compte</h1>
            <div className="shrink-0 rounded-lg border-[3px] border-brand-border bg-brand-inner p-2">
              <span className="font-display text-tx-base">ID</span>
            </div>
          </div>
      
      {step === 'pseudo' ? (
        <form onSubmit={handleNext} className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-tx-secondary">
              Choisis un pseudo (unique)
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

          <ConsentBox checked={accepted} onChange={setAccepted} minorNote />

          <button
            type="submit"
            disabled={!accepted}
            className={cn(
              'w-full h-14 rounded-xl font-display text-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform',
              !accepted && 'opacity-50 cursor-not-allowed'
            )}
          >
            Continuer avec un pseudo
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-[2px] bg-brand-border" />
            <div className="text-sm font-black text-tx-secondary">ou</div>
            <div className="flex-1 h-[2px] bg-brand-border" />
          </div>

          <button
            type="button"
            disabled={!accepted}
            onClick={() => {
              if (!accepted) return;
              try { sessionStorage.setItem(DISCORD_CONSENT_KEY, '1'); } catch {}
              let next = '/';
              try { next = sessionStorage.getItem('itollec_next_path') || '/'; } catch {}
              void loginDiscord(next);
            }}
            className={cn(
              'w-full h-14 rounded-xl font-display text-xl border-[3px] border-brand-border bg-[#5865F2] text-white shadow-[inset_0_-5px_0_#3C45C4,0_4px_0_#05061A] active:translate-y-[3px] transition-transform',
              !accepted && 'opacity-50 cursor-not-allowed'
            )}
          >
            Créer mon compte avec Discord
          </button>

          <div className="text-center text-sm font-black text-tx-secondary">
            Déjà un compte ?{' '}
            <Link href="/connexion" className="text-tx-base hover:text-accent-primary transition-colors">
              Se connecter
            </Link>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="bg-brand-inner border-4 border-brand-border rounded-[22px] p-6 shadow-brutal relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/5" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl border-[3px] border-brand-border bg-brand-card flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="font-display text-lg text-tx-base">Très important</h2>
              </div>

              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-card p-4">
                <p className="text-sm text-tx-secondary font-bold leading-relaxed">
                  Voici tes 6 mots secrets. <span className="text-tx-base">C&apos;est ton SEUL moyen de te connecter.</span>{' '}
                  Si tu les perds, <span className="text-red-400 underline decoration-red-500/50">ton compte et tes sauvegardes seront perdus à tout jamais.</span>
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {words.map((word, i) => (
                  <div
                    key={i}
                    className="bg-brand-card border-[3px] border-brand-border rounded-2xl py-3 px-4 shadow-brutal text-center font-display text-tx-base"
                  >
                    {word}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="flex-1 h-12 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Régénérer
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 h-12 rounded-xl border-[3px] font-display text-lg border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copier
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRegister}
            disabled={loading || !accepted}
            className={cn(
              'w-full h-14 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-[3px]',
              'bg-brand-inner text-tx-base border-brand-border hover:bg-[#333A80]',
              (loading || !accepted) && 'opacity-60 cursor-not-allowed hover:bg-brand-inner hover:text-tx-base hover:border-brand-border'
            )}
          >
            {loading ? 'Création...' : "J'ai sauvegardé mes mots, créer mon compte"}
          </button>

          <button
            type="button"
            onClick={() => router.push('/connexion')}
            className="w-full h-12 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform"
          >
            J&apos;ai déjà un compte
          </button>
        </div>
      )}
        </div>
      </div>
    </main>
  );
}
