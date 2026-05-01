'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LogOut, User } from 'lucide-react';
import Image from 'next/image';

export function GlobalHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-brand-surface/80 backdrop-blur-md border-b border-white/5 z-50 px-4 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg text-brand-primary flex items-center gap-2">
        <span>Itollec</span>
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link href="/profil" className="flex items-center gap-2 hover:bg-white/5 p-1 pr-3 rounded-full transition-colors">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold">
                  {user.pseudo[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">{user.pseudo}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={logout} title="Se déconnecter">
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/connexion')}>
              Se connecter
            </Button>
            <Button size="sm" onClick={() => router.push('/creer-compte')}>
              Créer un compte
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
