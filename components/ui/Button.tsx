import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'purple';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-xl transition-all duration-100 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-[0_4px_0_0px_#020617] active:translate-y-[4px] active:shadow-none',
      secondary: 'bg-[#334155] text-white hover:bg-[#475569] shadow-[0_4px_0_0px_#020617] active:translate-y-[4px] active:shadow-none',
      outline: 'bg-transparent border-2 border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-white hover:border-[#475569] active:translate-y-[4px] active:shadow-none',
      ghost: 'bg-transparent border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B] active:translate-y-[4px] active:shadow-none',
      purple: 'bg-[#6366F1] text-white hover:bg-[#4F46E5] shadow-[0_4px_0_0px_#020617] active:translate-y-[4px] active:shadow-none',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-xs h-8',
      md: 'px-5 py-2.5 text-sm h-11',
      lg: 'px-8 py-3.5 text-base h-14',
      icon: 'h-11 w-11 p-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
