'use client';

import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster 
      position="top-center" 
      theme="dark"
      richColors
      closeButton={false}
      visibleToasts={1} // Prevent spam by showing only 1 toast at a time
      expand={false}
      toastOptions={{
        className: 'border-2 border-white/10 bg-slate-900/90 backdrop-blur-md shadow-2xl rounded-2xl p-4 font-bold text-lg text-center',
        style: {
           zIndex: 99999,
           minWidth: '300px'
        },
        duration: 2000 // Short duration for better rotation
      }}
    />
  );
}
