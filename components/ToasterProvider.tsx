'use client';

import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster 
      position="top-center" 
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        className: 'border-2 border-white/10 bg-slate-900/90 backdrop-blur-md shadow-2xl rounded-xl p-4 font-bold text-lg',
        style: {
           zIndex: 99999
        }
      }}
    />
  );
}
