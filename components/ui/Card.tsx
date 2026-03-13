import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-[#1E293B] border border-[#334155]',
      'text-[#F8FAFC] rounded-2xl',
      className
    )}>
      {children}
    </div>
  );
}
