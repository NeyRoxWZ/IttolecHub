import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex w-full bg-[#151942] text-white rounded-xl px-4 py-3 font-bold text-base border-[3px] border-[#05061A]',
          'placeholder:text-[#8A92C4] placeholder:font-semibold',
          'focus:outline-none focus:ring-4 focus:ring-[#FFC61A] transition-shadow duration-100',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'shadow-[inset_0_3px_0_#0B0E2A]',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
