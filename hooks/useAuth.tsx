'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ConsentBox, { DISCORD_CONSENT_KEY } from '@/components/ConsentBox';

export type User = {
  id: string;
  pseudo: string;
  discord_id?: string;
  discord_username?: string;
  avatar_url?: string;
  is_discord?: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginDiscord: (nextPath?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserLocally: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDiscord, setPendingDiscord] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const router = useRouter();

  // Who is signed in comes from the server's session cookie, never from
  // anything the browser keeps: the old localStorage id let anyone pose as
  // anyone. Discord players trade their Supabase token for that cookie.
  const fetchUser = async () => {
    try {
      // The old way of remembering a player: dropped, everyone signs in once more.
      try { localStorage.removeItem('itollec_user_id'); } catch {}

      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (me?.user) {
        setUser(me.user);
        setPendingDiscord(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // A new account needs the Conditions accepted first. Coming from
        // "Créer un compte", the box was ticked there; coming straight from
        // "Connexion", ask now, before anything is saved.
        let consented = false;
        try { consented = sessionStorage.getItem(DISCORD_CONSENT_KEY) === '1'; } catch {}

        const res = await fetch('/api/auth/discord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token, consent: consented }),
        });
        const data = await res.json().catch(() => null);
        if (data?.needsConsent) {
          setPendingDiscord(true);
          setUser(null);
          return;
        }
        if (res.ok && data?.user) {
          try { sessionStorage.removeItem(DISCORD_CONSENT_KEY); } catch {}
          setPendingDiscord(false);
          setUser(data.user);
          return;
        }
        if (!res.ok) toast.error(data?.error || 'Connexion Discord impossible');
      }

      setUser(null);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    
    // Listen to Supabase Auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchUser();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginDiscord = async (nextPath?: string) => {
    const safeNext = typeof nextPath === 'string' && nextPath.startsWith('/') && !nextPath.startsWith('//') && !nextPath.startsWith('/\\') ? nextPath : '/';
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/connexion?next=${encodeURIComponent(safeNext)}`
      }
    });
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    setUser(null);
    router.push('/');
    toast.success('Déconnecté');
  };

  /** After a passphrase sign-in or sign-up: the server has already set the cookie. */
  const setUserLocally = (newUser: User) => {
    setUser({ ...newUser, is_discord: false });
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginDiscord, logout, refreshUser: fetchUser, setUserLocally }}>
      {children}
      {pendingDiscord && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl font-black leading-tight">Créer ton compte avec Discord</h2>
            <p className="text-sm text-tx-secondary">
              Aucun compte ItollecHub n&apos;est encore lié à ce Discord. Accepte les conditions pour le créer.
            </p>
            <ConsentBox checked={consentTicked} onChange={setConsentTicked} minorNote />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => { setPendingDiscord(false); await supabase.auth.signOut(); }}
                className="h-12 rounded-lg border-2 border-brand-border bg-brand-inner font-display font-black tracking-wider uppercase"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!consentTicked}
                onClick={() => {
                  try { sessionStorage.setItem(DISCORD_CONSENT_KEY, '1'); } catch {}
                  void fetchUser();
                }}
                className="h-12 rounded-lg border-2 border-brand-border bg-tx-base text-brand-bg font-display font-black tracking-wider uppercase disabled:opacity-40"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
