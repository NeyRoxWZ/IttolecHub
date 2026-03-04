import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          // Gamey Style: Chunky, Bold, No Outline, Bottom Border
          'flex w-full bg-white text-slate-900 border-b-4 border-slate-300 rounded-xl px-4 py-3 font-bold text-lg',
          'placeholder:text-slate-400 placeholder:font-medium',
          'focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/50 transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';