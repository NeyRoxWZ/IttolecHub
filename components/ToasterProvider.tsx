'use client';

import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster 
      position="bottom-right" 
      theme="dark"
      richColors={false}
      closeButton={false}
      visibleToasts={3}
      expand={true}
      toastOptions={{
        classNames: {
          toast: 'group w-full border-4 border-brand-border bg-brand-card shadow-brutal rounded-xl p-4 font-display font-bold text-lg text-tx-base transition-all data-[expanded=false]:opacity-100',
          title: 'text-tx-base',
          description: 'text-tx-secondary',
          success: 'bg-brand-card border-accent-success text-accent-success',
          error: 'bg-brand-card border-accent-secondary text-accent-secondary',
          info: 'bg-brand-card border-accent-info text-accent-info',
          warning: 'bg-brand-card border-accent-primary text-accent-primary',
        },
        style: {
           zIndex: 99999,
           minWidth: '300px'
        },
        duration: 3000
      }}
    />
  );
}
