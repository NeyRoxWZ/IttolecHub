import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex w-full bg-[#334155] text-white rounded-xl px-4 py-3 font-medium text-base',
          'placeholder:text-[#94A3B8] placeholder:font-medium',
          'focus:outline-none focus:ring-0 focus:border-2 focus:border-[#3B82F6] focus:bg-[#334155] transition-all duration-100',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'shadow-[4px_4px_0px_0px_#020617]',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
