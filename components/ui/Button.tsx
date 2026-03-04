import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', ...props }, ref) => {
    // Gamey Style Base Classes
    const baseClasses = 'inline-flex items-center justify-center font-black uppercase tracking-wider rounded-xl transition-all focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-1 active:border-b-0 border-b-4';
    
    const variants = {
      primary: 'bg-indigo-500 border-indigo-700 text-white hover:bg-indigo-400 hover:border-indigo-600',
      secondary: 'bg-slate-700 border-slate-900 text-white hover:bg-slate-600 hover:border-slate-800',
      outline: 'bg-transparent border-2 border-slate-500 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-400 active:translate-y-0 active:border-2', // Less gamey for outline
      ghost: 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5 active:translate-y-0 active:border-transparent', // No 3D for ghost
    };
    
    const sizes = {
      sm: 'px-3 py-1 text-xs h-8',
      md: 'px-5 py-2 text-sm h-12',
      lg: 'px-8 py-4 text-lg h-16',
      icon: 'h-12 w-12 p-0 flex items-center justify-center',
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