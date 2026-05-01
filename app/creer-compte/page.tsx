'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { generatePassphrase } from '@/lib/words';
import { Copy, RefreshCw } from 'lucide-react';
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
      toast.success('Compte créé avec succès !');
      router.push('/profil');
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
          <div className="bg-brand-bg p-4 rounded-lg border border-white/10 text-center">
            <p className="text-sm text-white/60 mb-4">
              Voici tes 6 mots secrets. <strong>Ne les perds pas</strong>, ils te serviront de mot de passe !
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {words.map((word, i) => (
                <span key={i} className="bg-brand-primary/20 text-brand-primary px-3 py-1 rounded-full font-medium">
                  {word}
                </span>
              ))}
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Changer
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>
          </div>

          <Button onClick={handleRegister} className="w-full" disabled={loading}>
            {loading ? 'Création...' : "J'ai bien noté mes mots, créer mon compte"}
          </Button>
        </div>
      )}
    </div>
  );
}
