import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
      'text-slate-800 dark:text-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200',
      'rounded-2xl',
      className
    )}>
      {children}
    </div>
  );
}