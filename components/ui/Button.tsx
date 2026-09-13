import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'purple';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * Brawl buttons: ink outline, a darker bottom edge that reads as relief, and
 * a press that sinks the button into it.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-display tracking-wide rounded-xl border-[3px] border-[#05061A] transition-transform duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FFC61A] disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-[3px]';

    const variants = {
      primary: 'bg-[#FFC61A] text-[#0E1030] shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] hover:bg-[#FFD24D] active:shadow-[inset_0_-2px_0_#D98E00,0_1px_0_#05061A]',
      secondary: 'bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] hover:bg-[#353C85] active:shadow-[inset_0_-2px_0_#1A1F52,0_1px_0_#05061A]',
      outline: 'bg-transparent border-[#C2C9F0] text-white hover:bg-white/10 active:translate-y-0',
      ghost: 'bg-transparent border-transparent text-[#C2C9F0] hover:text-white hover:bg-white/10 active:translate-y-0',
      purple: 'bg-[#FF4F8B] text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] hover:bg-[#FF6C9E] active:shadow-[inset_0_-2px_0_#C92D63,0_1px_0_#05061A]',
    };

    const sizes = {
      sm: 'px-3 text-sm h-9',
      md: 'px-5 text-base h-12',
      lg: 'px-8 text-lg h-14',
      icon: 'h-12 w-12 p-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
