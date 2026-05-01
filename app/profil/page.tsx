'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { generatePassphrase } from '@/lib/words';
import { LogOut, Edit2, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';

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
    <div className="max-w-3xl mx-auto mt-10 p-4">
      <div className="bg-brand-surface rounded-xl p-6 shadow-lg border border-white/5 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-brand-bg" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-brand-primary flex items-center justify-center text-4xl font-bold text-white border-4 border-brand-bg">
              {user.pseudo[0].toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="flex-1 w-full text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3 mb-2 justify-center md:justify-start">
            {editingPseudo ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={newPseudo} 
                  onChange={e => setNewPseudo(e.target.value)} 
                  className="max-w-[200px]"
                  placeholder="Nouveau pseudo"
                />
                <Button size="sm" onClick={handleUpdatePseudo} disabled={saving}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingPseudo(false)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{user.pseudo}</h1>
                <Button size="icon" variant="ghost" onClick={() => { setNewPseudo(user.pseudo); setEditingPseudo(true); }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
          
          <div className="text-sm text-white/60 mb-4">
            Méthode de connexion : <span className="font-semibold text-white/90">{user.is_discord ? 'Discord' : 'Passphrase'}</span>
          </div>

          {!user.is_discord && (
            <div className="bg-brand-bg p-4 rounded-lg border border-white/5">
              <h3 className="font-semibold mb-2">Sécurité Passphrase</h3>
              {regenerating ? (
                <div className="space-y-3">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded text-sm flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>Attention : si tu valides, l&apos;ancienne passphrase sera détruite. Note bien les nouveaux mots ci-dessous.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {newWords.map((w, i) => (
                      <span key={i} className="bg-brand-primary/20 text-brand-primary px-2 py-1 rounded font-mono text-sm">{w}</span>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-center md:justify-start">
                    <Button size="sm" variant="outline" onClick={copyNewWords}>
                      <Copy className="w-4 h-4 mr-2" /> Copier
                    </Button>
                    <Button size="sm" onClick={confirmRegenerate} disabled={saving}>
                      Valider les nouveaux mots
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRegenerating(false); setNewWords([]); }}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleRegenerateWords}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Régénérer mes mots
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="shrink-0 mt-4 md:mt-0">
          <Button variant="outline" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Button>
        </div>
      </div>

      {/* Statistiques globales */}
      <h2 className="text-xl font-bold mb-4">Statistiques & Progression</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Placeholder pour les stats ItollecClicker */}
        <div className="bg-brand-surface p-5 rounded-xl border border-white/5">
          <h3 className="font-bold text-lg text-yellow-500 mb-2">👑 ItollecClicker</h3>
          <p className="text-sm text-white/60 mb-4">Progression de ton empire napoléonien</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Livres Tournois</span>
              <span className="font-mono font-bold">0 ₶</span>
            </div>
            <div className="flex justify-between">
              <span>Bâtiments</span>
              <span className="font-mono">0</span>
            </div>
            <div className="flex justify-between">
              <span>Succès</span>
              <span className="font-mono">0 / 200</span>
            </div>
          </div>
          <Button className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => router.push('/itollec-clicker')}>
            Jouer
          </Button>
        </div>

        {/* Placeholder pour les stats TerraFarm */}
        <div className="bg-brand-surface p-5 rounded-xl border border-white/5">
          <h3 className="font-bold text-lg text-green-500 mb-2">🌿 TerraFarm</h3>
          <p className="text-sm text-white/60 mb-4">L&apos;expansion de ton domaine agricole</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Francs Paysans</span>
              <span className="font-mono font-bold">0 ƒ</span>
            </div>
            <div className="flex justify-between">
              <span>Zones débloquées</span>
              <span className="font-mono">1 / 6</span>
            </div>
            <div className="flex justify-between">
              <span>Succès</span>
              <span className="font-mono">0 / 150</span>
            </div>
          </div>
          <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white" onClick={() => router.push('/terrafarm')}>
            Jouer
          </Button>
        </div>
      </div>
    </div>
  );
}
