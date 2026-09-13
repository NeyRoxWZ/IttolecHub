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
    const baseClasses = 'inline-flex items-center justify-center font-display tracking-wide rounded-xl border-[3px] border-[#14142B] transition-transform duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-[3px]';

    const variants = {
      primary: 'bg-[#FFC61A] text-[#14142B] shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#14142B] hover:bg-[#FFD24D] active:shadow-[inset_0_-2px_0_#D98E00,0_1px_0_#14142B]',
      secondary: 'bg-white text-[#14142B] shadow-[inset_0_-5px_0_#C3CBE3,0_4px_0_#14142B] hover:bg-[#F3F6FF] active:shadow-[inset_0_-2px_0_#C3CBE3,0_1px_0_#14142B]',
      outline: 'bg-transparent text-[#14142B] hover:bg-white/40 active:translate-y-0',
      ghost: 'bg-transparent border-transparent text-[#14142B] hover:bg-white/40 active:translate-y-0',
      purple: 'bg-[#FF4F8B] text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#14142B] hover:bg-[#FF6C9E] active:shadow-[inset_0_-2px_0_#C92D63,0_1px_0_#14142B]',
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
