import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'ghost'
    | 'success'
    | 'outline'
    | 'purple';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-body font-semibold transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-accent-primary text-text-primary hover:bg-accent-primary-hover hover:shadow-glow-primary',
      secondary:
        'bg-transparent border border-accent-primary text-accent-primary hover:bg-accent-primary/10',
      danger: 'bg-accent-danger text-text-primary hover:brightness-95',
      ghost: 'bg-transparent text-text-primary hover:bg-brand-inner',
      success: 'bg-accent-success text-text-primary hover:brightness-95',
      outline:
        'bg-transparent border border-brand-border text-text-secondary hover:bg-brand-inner hover:text-text-primary',
      purple:
        'bg-accent-primary text-text-primary hover:bg-accent-primary-hover hover:shadow-glow-primary',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3 text-base',
      icon: 'h-10 w-10 p-0',
    };

    const isDisabled = Boolean(disabled || isLoading);

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon ? (
          <span className="shrink-0">{rightIcon}</span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
