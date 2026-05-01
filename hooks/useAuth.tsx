'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
  loginDiscord: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserLocally: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      // 1. Check if Supabase Auth has a session (Discord)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Find or create in our custom `users` table
        const discordId = session.user.user_metadata?.provider_id || session.user.id;
        const discordUsername = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Joueur Discord';
        const avatarUrl = session.user.user_metadata?.avatar_url;

        let { data: dbUser } = await supabase
          .from('users')
          .select('id, pseudo, discord_id, discord_username, avatar_url')
          .eq('discord_id', discordId)
          .maybeSingle();

        if (!dbUser) {
          // Check if pseudo exists, if so append random digits
          let pseudo = discordUsername;
          const { data: existingPseudo } = await supabase.from('users').select('id').eq('pseudo', pseudo).maybeSingle();
          if (existingPseudo) {
            pseudo = `${pseudo}${Math.floor(Math.random() * 10000)}`;
          }

          const { data: newUser, error } = await supabase
            .from('users')
            .insert([{
              pseudo,
              discord_id: discordId,
              discord_username: discordUsername,
              avatar_url: avatarUrl
            }])
            .select()
            .single();

          if (!error && newUser) {
            dbUser = newUser;
          }
        }

        if (dbUser) {
          setUser({ ...dbUser, is_discord: true });
          setLoading(false);
          return;
        }
      }

      // 2. Check LocalStorage for Passphrase user
      const localUserId = localStorage.getItem('itollec_user_id');
      if (localUserId) {
        const { data: localUser } = await supabase
          .from('users')
          .select('id, pseudo, avatar_url, discord_id')
          .eq('id', localUserId)
          .maybeSingle();

        if (localUser) {
          setUser({ ...localUser, is_discord: !!localUser.discord_id });
        } else {
          localStorage.removeItem('itollec_user_id');
        }
      }
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

  const loginDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
  };

  const logout = async () => {
    if (user?.is_discord) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('itollec_user_id');
    setUser(null);
    router.push('/');
    toast.success('Déconnecté');
  };

  const setUserLocally = (newUser: User) => {
    localStorage.setItem('itollec_user_id', newUser.id);
    setUser({ ...newUser, is_discord: false });
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginDiscord, logout, refreshUser: fetchUser, setUserLocally }}>
      {children}
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
