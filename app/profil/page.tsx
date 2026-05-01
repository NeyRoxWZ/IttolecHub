'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { generatePassphrase } from '@/lib/words';
import { LogOut, Edit2, RefreshCw, AlertTriangle, Copy, Check, Crown, Leaf } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ProfilPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [newPseudo, setNewPseudo] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [newWords, setNewWords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/connexion');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="pt-20 text-center">Chargement...</div>;
  }

  const handleUpdatePseudo = async () => {
    if (!newPseudo.trim() || newPseudo === user.pseudo) {
      setEditingPseudo(false);
      return;
    }
    
    setSaving(true);
    try {
      // Check if pseudo is unique
      const { data: existing } = await supabase.from('users').select('id').eq('pseudo', newPseudo).maybeSingle();
      if (existing) {
        toast.error('Ce pseudo est déjà pris');
        return;
      }

      const { error } = await supabase.from('users').update({ pseudo: newPseudo }).eq('id', user.id);
      if (error) throw error;
      
      toast.success('Pseudo mis à jour');
      setEditingPseudo(false);
      refreshUser();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWords = async () => {
    const words = generatePassphrase();
    setNewWords(words);
    setRegenerating(true);
  };

  const confirmRegenerate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/regenerate-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, words: newWords })
      });
      
      if (!res.ok) throw new Error('Erreur de régénération');
      
      toast.success('Passphrase mise à jour avec succès');
      setRegenerating(false);
      setNewWords([]);
    } catch (err) {
      toast.error('Erreur lors de la mise à jour des mots');
    } finally {
      setSaving(false);
    }
  };

  const copyNewWords = () => {
    navigator.clipboard.writeText(newWords.join(' '));
    toast.success('Mots copiés !');
  };

  return (
    <main className="min-h-screen bg-transparent px-6 pt-8 pb-12">
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-center mb-8">
          <Link
            href="/"
            className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
          >
            Retour
          </Link>
        </div>

        <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-brand-border shadow-brutal" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-brand-inner border-4 border-brand-border shadow-brutal flex items-center justify-center font-display font-black text-4xl text-tx-base">
                  {user.pseudo[0].toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start">
                {editingPseudo ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                    <input
                      value={newPseudo}
                      onChange={(e) => setNewPseudo(e.target.value)}
                      placeholder="Nouveau pseudo"
                      className="w-full sm:max-w-[260px] h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpdatePseudo}
                        disabled={saving}
                        className={cn(
                          'h-12 px-4 rounded-lg border-2 border-brand-border font-display font-black tracking-wider uppercase transition-colors flex items-center justify-center gap-2',
                          'bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base',
                          saving && 'opacity-60 cursor-not-allowed hover:bg-brand-inner hover:text-tx-base hover:border-brand-border'
                        )}
                      >
                        <Check className="w-4 h-4" />
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPseudo(false)}
                        className="h-12 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display text-3xl md:text-4xl font-black tracking-wider uppercase text-center sm:text-left">
                      {user.pseudo}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPseudo(user.pseudo);
                        setEditingPseudo(true);
                      }}
                      className="h-11 w-11 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center"
                      title="Modifier le pseudo"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                  Méthode de connexion
                </div>
                <div className="mt-1 font-display font-black tracking-wider uppercase text-tx-base">
                  {user.is_discord ? 'Discord' : 'Passphrase'}
                </div>
              </div>

              {!user.is_discord && (
                <div className="mt-4 rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Passphrase</div>
                      <div className="mt-1 font-display font-black tracking-wider uppercase text-tx-base">Sécurité</div>
                    </div>
                    {!regenerating && (
                      <button
                        type="button"
                        onClick={handleRegenerateWords}
                        className="h-12 px-4 rounded-lg border-2 border-brand-border bg-brand-card text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Régénérer
                      </button>
                    )}
                  </div>

                  {regenerating && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          </div>
                          <p className="text-sm text-tx-secondary font-bold leading-relaxed">
                            Attention : si tu valides, l&apos;ancienne passphrase sera détruite. Note bien les nouveaux mots ci-dessous.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {newWords.map((w, i) => (
                          <div
                            key={i}
                            className="bg-brand-card border-2 border-brand-border rounded-2xl py-3 px-4 shadow-brutal text-center font-display font-black tracking-wider uppercase text-tx-base"
                          >
                            {w}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={copyNewWords}
                          className="flex-1 h-12 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copier
                        </button>
                        <button
                          type="button"
                          onClick={confirmRegenerate}
                          disabled={saving}
                          className={cn(
                            'flex-1 h-12 rounded-lg border-2 border-brand-border font-display font-black tracking-wider uppercase transition-colors flex items-center justify-center gap-2',
                            'bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base',
                            saving && 'opacity-60 cursor-not-allowed hover:bg-brand-inner hover:text-tx-base hover:border-brand-border'
                          )}
                        >
                          <Check className="w-4 h-4" />
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegenerating(false);
                            setNewWords([]);
                          }}
                          className="flex-1 h-12 rounded-lg border-2 border-brand-border bg-brand-card text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={logout}
                className="w-full md:w-auto h-12 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-wider uppercase text-center md:text-left">
            Statistiques
          </h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
              <div className="flex items-center justify-between h-12">
                <h3 className="font-display text-2xl leading-none">ItollecClicker</h3>
                <div className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                  <Crown className="h-6 w-6 text-accent-secondary" />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border-2 border-brand-border bg-brand-inner p-4 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Livres Tournois</span>
                  <span className="font-mono text-tx-base">0 ₶</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Bâtiments</span>
                  <span className="font-mono text-tx-base">0</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Succès</span>
                  <span className="font-mono text-tx-base">0 / 200</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/itollec-clicker')}
                className="mt-auto w-full h-14 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              >
                Jouer
              </button>
            </div>

            <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
              <div className="flex items-center justify-between h-12">
                <h3 className="font-display text-2xl leading-none">TerraFarm</h3>
                <div className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                  <Leaf className="h-6 w-6 text-accent-success" />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border-2 border-brand-border bg-brand-inner p-4 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Francs Paysans</span>
                  <span className="font-mono text-tx-base">0 ƒ</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Zones</span>
                  <span className="font-mono text-tx-base">1 / 6</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-tx-secondary">Succès</span>
                  <span className="font-mono text-tx-base">0 / 150</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/terrafarm')}
                className="mt-auto w-full h-14 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              >
                Jouer
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
