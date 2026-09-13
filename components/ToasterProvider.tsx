'use client';

import { Toaster } from 'sonner';

/**
 * Toasts in the Brawl style: a chunky card with a black outline and a hard
 * shadow, filled with the colour of what happened — green for a win, pink for
 * an error, blue for information, yellow for a warning. Sonner's own look is
 * switched off (`unstyled`) so nothing of it bleeds through.
 */
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
        unstyled: true,
        classNames: {
          toast:
            'group w-full flex items-center gap-3 rounded-2xl border-[3px] border-[#05061A] bg-[#1E2358] text-white px-4 py-3 shadow-[inset_0_-5px_0_#151942,0_5px_0_#05061A] font-display text-lg leading-tight',
          title: 'font-display text-lg leading-tight',
          description: 'font-body text-sm font-black leading-snug mt-0.5 opacity-85',
          icon: 'shrink-0 [&>svg]:h-6 [&>svg]:w-6',
          success: '!bg-[#33D17A] !text-[#0E1030] !shadow-[inset_0_-5px_0_#1E9A55,0_5px_0_#05061A]',
          error: '!bg-[#FF4F8B] !text-white !shadow-[inset_0_-5px_0_#C92D63,0_5px_0_#05061A]',
          info: '!bg-[#3B6BFF] !text-white !shadow-[inset_0_-5px_0_#2A4FC4,0_5px_0_#05061A]',
          warning: '!bg-[#FFC61A] !text-[#0E1030] !shadow-[inset_0_-5px_0_#D98E00,0_5px_0_#05061A]',
          actionButton: 'ml-auto shrink-0 h-9 px-3 rounded-xl border-[3px] border-[#05061A] bg-[#FFC61A] text-[#0E1030] font-display text-sm',
          cancelButton: 'shrink-0 h-9 px-3 rounded-xl border-[3px] border-[#05061A] bg-[#2B3170] text-white font-display text-sm',
        },
        style: {
          zIndex: 99999,
          minWidth: '300px',
        },
        duration: 3000,
      }}
    />
  );
}
