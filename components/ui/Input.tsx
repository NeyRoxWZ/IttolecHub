import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex w-full bg-white text-[#14142B] rounded-xl px-4 py-3 font-bold text-base border-[3px] border-[#14142B]',
          'placeholder:text-[#7A7F9A] placeholder:font-semibold',
          'focus:outline-none focus:ring-4 focus:ring-[#FFC61A] transition-shadow duration-100',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'shadow-[inset_0_3px_0_#EAF0FF]',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
