'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { generatePassphrase } from '@/lib/words';
import { Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function CreerComptePage() {
  const [pseudo, setPseudo] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'pseudo' | 'words'>('pseudo');
  const router = useRouter();
  const { setUserLocally } = useAuth();

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
    <div className="max-w-md mx-auto mt-20 p-6 bg-brand-surface rounded-xl shadow-lg border border-white/5">
      <h1 className="text-2xl font-bold mb-6 text-center text-brand-primary">Créer un compte</h1>
      
      {step === 'pseudo' ? (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Choisis un pseudo unique</label>
            <Input 
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Ton pseudo"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Continuer
          </Button>
          <div className="mt-4 text-center text-sm text-white/60">
            Déjà un compte ?{' '}
            <Link href="/connexion" className="text-brand-primary hover:underline">
              Se connecter
            </Link>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-brand-bg p-4 rounded-lg border border-red-500/30 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/5" />
            <div className="relative z-10">
              <h3 className="text-red-400 font-bold mb-2 flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                TRÈS IMPORTANT
              </h3>
              <p className="text-sm text-white/80 mb-4">
                Voici tes 6 mots secrets. <strong>C&apos;est ton SEUL moyen de te connecter.</strong><br/>
                Si tu les perds, <span className="text-red-400 underline decoration-red-500/50">ton compte et tes sauvegardes seront perdus à tout jamais.</span>
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4 p-3 bg-brand-surface rounded-lg border border-white/5 shadow-inner">
                {words.map((word, i) => (
                  <span key={i} className="bg-brand-primary/20 text-brand-primary px-3 py-1 rounded-full font-medium text-lg">
                    {word}
                  </span>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate} className="hover:bg-white/5">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Changer
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className="border-brand-primary/50 text-brand-primary hover:bg-brand-primary/10">
                  <Copy className="w-4 h-4 mr-2" />
                  Copier mes mots
                </Button>
              </div>
            </div>
          </div>

          <Button onClick={handleRegister} className="w-full font-bold shadow-lg" disabled={loading}>
            {loading ? 'Création...' : "J'ai sauvegardé mes mots, créer mon compte"}
          </Button>
        </div>
      )}
    </div>
  );
}
