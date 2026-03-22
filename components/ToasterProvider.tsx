'use client';

import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster 
      position="bottom-right" 
      theme="dark"
      richColors
      closeButton={false}
      visibleToasts={3}
      expand={false}
      toastOptions={{
        className: 'border-4 border-brand-border bg-brand-card shadow-brutal rounded-xl p-4 font-display font-bold text-lg text-tx-base',
        style: {
           zIndex: 99999,
           minWidth: '300px'
        },
        duration: 3000
      }}
    />
  );
}
