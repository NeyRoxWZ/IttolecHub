'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { generatePassphrase } from '@/lib/words';
import { ArrowLeft, LogOut, Edit2, RefreshCw, AlertTriangle, Copy, Check, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import ProfileStats from './ProfileStats';
import DeleteAccount from './DeleteAccount';
import OgName, { BadgePlaque } from '@/components/OgName';
import DonateButton from '@/components/DonateStrip';
import { useOgProfile } from '@/hooks/useOg';
import { BADGE_INFO, ownedBadges, refreshOg, setBadgeVisible, type BadgeId } from '@/lib/og';
import { cn } from '@/lib/utils';

export default function ProfilPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [newPseudo, setNewPseudo] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [newWords, setNewWords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const og = useOgProfile(user?.pseudo);
  const [badgeSaving, setBadgeSaving] = useState<BadgeId | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/connexion?next=%2Fprofil');
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
      const res = await fetch('/api/auth/pseudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: newPseudo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Erreur lors de la mise à jour');
        return;
      }
      
      toast.success('Pseudo mis à jour');
      setEditingPseudo(false);
      refreshUser();
      // The badge belongs to the account: re-read the list so it follows the new pseudo at once.
      if (og) void refreshOg();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const toggleBadge = async (badge: BadgeId) => {
    if (!og) return;
    const next = og.hidden.includes(badge);
    setBadgeSaving(badge);
    try {
      await setBadgeVisible(user.id, badge, next);
      toast.success(next ? 'Badge affiché' : 'Badge masqué');
    } catch {
      toast.error('Erreur lors de la mise à jour du badge');
    } finally {
      setBadgeSaving(null);
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
    <main className="min-h-screen bg-transparent px-3 sm:px-6 pt-3 sm:pt-5 pb-10">
      <div className="w-full max-w-7xl mx-auto">
        <div className="w-full flex items-center justify-between gap-4 mb-6">
          <div className="flex-1 flex items-center">
            <Link
              href="/"
              aria-label="Accueil"
              className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={3} />
            </Link>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={logout}
              className="h-12 px-4 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform flex items-center justify-center gap-2 font-display text-lg"
              title="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-brutal">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="shrink-0">
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt="Avatar" width={96} height={96} unoptimized className="w-24 h-24 rounded-full border-4 border-brand-border shadow-brutal" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-brand-inner border-4 border-brand-border shadow-brutal flex items-center justify-center font-display text-4xl text-tx-base">
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
                      className="w-full sm:max-w-[260px] h-12 rounded-lg bg-brand-inner border-[3px] border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpdatePseudo}
                        disabled={saving}
                        className={cn(
                          'h-12 px-4 rounded-lg border-[3px] border-brand-border font-display font-black tracking-wider uppercase transition-colors flex items-center justify-center gap-2',
                          'bg-brand-inner text-tx-base hover:bg-[#333A80]',
                          saving && 'opacity-60 cursor-not-allowed hover:bg-brand-inner hover:text-tx-base hover:border-brand-border'
                        )}
                      >
                        <Check className="w-4 h-4" />
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPseudo(false)}
                        className="h-12 px-4 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display text-3xl md:text-4xl text-center sm:text-left">
                      <OgName name={user.pseudo} truncate={false} />
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPseudo(user.pseudo);
                        setEditingPseudo(true);
                      }}
                      className="h-11 w-11 rounded-lg border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A] active:translate-y-[2px] transition-transform flex items-center justify-center"
                      title="Modifier le pseudo"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 rounded-2xl border-[3px] border-brand-border bg-brand-inner p-4">
                <div className="text-sm font-black text-tx-secondary">Mes badges</div>
                {!og || ownedBadges(og).length === 0 ? (
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="flex-1 text-sm text-tx-secondary font-bold leading-relaxed">
                      Tu n’as aucun badge pour l’instant. Pour en débloquer un, tu peux <span className="text-white">faire un don</span> : tu recevras le badge Donateur.
                    </p>
                    <DonateButton pseudo={user.pseudo} avatarUrl={user.avatar_url} label="Faire un don" />
                  </div>
                ) : (
                <>
                  <p className="mt-1 text-sm text-tx-secondary font-bold leading-relaxed">
                    Choisis ceux qui s’affichent à côté de ton pseudo. Ils restent attachés à ton compte, même si tu changes de pseudo.
                  </p>
                  <div className="mt-3 space-y-2">
                    {ownedBadges(og).map((b) => {
                      const shown = !og.hidden.includes(b);
                      return (
                        <div key={b} className="flex items-center gap-3 rounded-xl border-[3px] border-brand-border bg-brand-card px-3 py-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2 font-display text-lg text-tx-base">
                            <BadgePlaque badge={b} /> <span className="truncate">{BADGE_INFO[b].hint}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleBadge(b)}
                            disabled={badgeSaving !== null}
                            className={cn(
                              'h-11 px-3 shrink-0 rounded-xl border-[3px] border-brand-border font-display text-base flex items-center justify-center gap-2 active:translate-y-[3px] transition-transform disabled:opacity-60',
                              shown
                                ? 'bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]'
                                : 'bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]'
                            )}
                          >
                            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {badgeSaving === b ? '···' : shown ? 'Masquer' : 'Afficher'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
                )}
              </div>

              <div className="mt-4 rounded-2xl border-[3px] border-brand-border bg-brand-inner p-4">
                <div className="text-sm font-black text-tx-secondary">
                  Méthode de connexion
                </div>
                <div className="mt-1 font-display text-tx-base">
                  {user.is_discord ? 'Discord' : 'Passphrase'}
                </div>
              </div>

              {!user.is_discord && (
                <div className="mt-4 rounded-2xl border-[3px] border-brand-border bg-brand-inner p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-tx-secondary">Passphrase</div>
                      <div className="mt-1 font-display text-tx-base">Sécurité</div>
                    </div>
                    {!regenerating && (
                      <button
                        type="button"
                        onClick={handleRegenerateWords}
                        className="h-12 px-4 rounded-xl border-[3px] font-display text-lg border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Régénérer
                      </button>
                    )}
                  </div>

                  {regenerating && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-card p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl border-[3px] border-brand-border bg-brand-inner flex items-center justify-center shrink-0">
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
                            className="bg-brand-card border-[3px] border-brand-border rounded-2xl py-3 px-4 shadow-brutal text-center font-display text-tx-base"
                          >
                            {w}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={copyNewWords}
                          className="flex-1 h-12 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] hover:bg-[#333A80] active:translate-y-[3px] transition-transform flex items-center justify-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copier
                        </button>
                        <button
                          type="button"
                          onClick={confirmRegenerate}
                          disabled={saving}
                          className={cn(
                            'flex-1 h-12 rounded-lg border-[3px] border-brand-border font-display font-black tracking-wider uppercase transition-colors flex items-center justify-center gap-2',
                            'bg-brand-inner text-tx-base hover:bg-[#333A80]',
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
                          className="flex-1 h-12 rounded-xl border-[3px] font-display text-lg border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 w-full md:w-auto" />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-display text-2xl md:text-3xl text-center md:text-left mb-6">
            Statistiques
          </h2>
          <ProfileStats userId={user.id} />
        </div>

        <DeleteAccount user={user} />
      </div>
    </main>
  );
}
